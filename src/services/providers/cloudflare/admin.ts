// src/services/providers/cloudflare/admin.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIRESTORE → NOW CLOUDFLARE D1 (via Cloudflare D1 HTTP REST API)
// Replaces all onSnapshot() calls with fetch + polling pattern.
// TODO: add Durable Objects for realtime later
// ─────────────────────────────────────────────────────────────────

import type { IAdminService, FeaturedBanner } from "@/src/services/admin"
import type { FirestoreDoc } from "@/src/types"

// ── D1 HTTP helper ───────────────────────────────────────────────
export async function d1Query<T = Record<string, unknown>>(
  sql:    string,
  params: unknown[] = [],
): Promise<T[]> {
  if (typeof window !== "undefined") {
    const res = await fetch("/api/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    })
    const json = await res.json() as any
    if (!res.ok) throw new Error(json?.error ?? `D1 proxy error (HTTP ${res.status})`)
    return (json.results ?? []) as T[]
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  })

  const json = await res.json() as any
  if (!json.success) {
    throw new Error(`D1 error: ${json.errors?.[0]?.message ?? "unknown"}`)
  }
  return (json.result?.[0]?.results ?? []) as T[]
}

function toIsoOrNull(v: unknown): string | null {
  if (!v) return null
  return String(v)
}

// ── Primary key resolution ────────────────────────────────────────
// Most tables use "id" as their primary key, but some use a different
// column (e.g. wallets keyed by user_id). getDoc/setDoc/updateDoc/deleteDoc/
// subscribeToDoc all need the correct PK column or every write against
// these tables silently fails ("no such column: id").
const PRIMARY_KEY_COLUMN: Record<string, string> = {
  users:                   "uid",
  seller_wallets:          "user_id",
  agent_wallets:           "user_id",
  logistics_agent_wallets: "user_id",
  agent_locations:         "agent_id",
  insurance_pool:          "month",
}
function pkColumn(table: string): string {
  return PRIMARY_KEY_COLUMN[table] ?? "id"
}

function rowToDoc(row: Record<string, unknown>): FirestoreDoc {
  const doc: Record<string, unknown> = { id: row.id ?? row.uid }
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    doc[camel] = v
  }
  if (doc.createdAt) doc.createdAt = toIsoOrNull(doc.createdAt)
  if (doc.updatedAt) doc.updatedAt = toIsoOrNull(doc.updatedAt)
  const boolCols = ["isActive","isBanned","isBoosted","ninVerified","bvnVerified",
                    "phoneVerified","emailVerified","isSellerReady"]
  for (const col of boolCols) if (col in doc) doc[col] = !!doc[col]
  return doc as FirestoreDoc
}

// ── Polling helper ────────────────────────────────────────────────
// Polling intervals tuned to reduce D1 reads:
//   - Chat messages : 15s  (was 5s  — 3× fewer reads)
//   - Notifications : 60s  (was 15s — 4× fewer reads; broadcast handles instant delivery)
//   - User chats    : 30s  (was 10s — 3× fewer reads)
//   - Admin/general : 60s  (was 30s — 2× fewer reads)
//   - Banners       : 120s (was 60s — 2× fewer reads; almost never changes)
function poll(
  fetcher:  () => Promise<unknown[]>,
  callback: (docs: unknown[]) => void,
  interval  = 60_000,
  onError?: (err: unknown) => void,
): () => void {
  let active = true

  const run = async () => {
    if (!active) return
    try {
      callback(await fetcher())
    } catch (err) {
      if (onError) {
        onError(err)
      } else {
        try { callback([]) } catch { /* ignore */ }
      }
    }
    if (active) setTimeout(run, interval)
  }

  run()
  return () => { active = false }
}

// ── Shared constraint → SQL builder ──────────────────────────────
function buildSelectQuery(table: string, constraints?: unknown[]): { sql: string; vals: unknown[] } {
  const toCol = (f: string) => f.replace(/([A-Z])/g, "_$1").toLowerCase()

  const wheres: string[] = []
  const vals: unknown[] = []
  let orderCol = "created_at"
  let orderDir = "DESC"
  let limitN: number | null = null

  for (const c of (constraints ?? []) as any[]) {
    if (!c) continue
    if ("field" in c && "op" in c) {
      const col = toCol(c.field === "__name__" ? "id" : c.field)
      if (c.op === "in" && Array.isArray(c.value)) {
        wheres.push(`${col} IN (${c.value.map(() => "?").join(",")})`)
        vals.push(...c.value)
      } else if (c.op === "array-contains") {
        wheres.push(`${col} LIKE ?`)
        vals.push(`%"${c.value}"%`)
      } else if (c.value === null && (c.op === "==" || c.op === "!=")) {
        wheres.push(c.op === "==" ? `${col} IS NULL` : `${col} IS NOT NULL`)
      } else {
        const opMap: Record<string, string> = { "==": "=", "!=": "!=", ">": ">", ">=": ">=", "<": "<", "<=": "<=" }
        wheres.push(`${col} ${opMap[c.op] ?? "="} ?`)
        vals.push(typeof c.value === "boolean" ? (c.value ? 1 : 0) : c.value)
      }
    } else if ("field" in c && "dir" in c) {
      orderCol = toCol(c.field)
      orderDir = (c.dir ?? "asc").toUpperCase() === "DESC" ? "DESC" : "ASC"
    } else if ("limit" in c) {
      limitN = c.limit
    }
  }

  let sql = `SELECT * FROM ${table}`
  if (wheres.length) sql += ` WHERE ${wheres.join(" AND ")}`
  sql += ` ORDER BY ${orderCol} ${orderDir}`
  if (limitN) sql += ` LIMIT ${limitN}`

  return { sql, vals }
}

// ── kv_store helpers ──────────────────────────────────────────────
// FIX: Removed CREATE TABLE IF NOT EXISTS from every read/write.
// The table is created once at migration time — running DDL on every
// config fetch was adding an extra D1 write/check per request.

async function kvGet(docId: string): Promise<Record<string, unknown> | null> {
  try {
    const rows = await d1Query<{ value: string }>(
      `SELECT value FROM kv_store WHERE key = ? LIMIT 1`,
      [`config:${docId}`]
    )
    if (!rows[0]) return null
    return JSON.parse(rows[0].value)
  } catch {
    return null
  }
}

async function kvSet(docId: string, data: Record<string, unknown>): Promise<void> {
  const key = `config:${docId}`
  const now = new Date().toISOString()
  const value = JSON.stringify({ ...data, updatedAt: now })
  // UPSERT in one query — no extra SELECT needed
  await d1Query(
    `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now]
  )
}

// ── Implementation ────────────────────────────────────────────────

export const AdminService: IAdminService = {

  // ── Subscribe methods ─────────────────────────────────────────

  subscribeToFeaturedBanners(callback) {
    return poll(async () => {
      const rows = await d1Query("SELECT id, tag, title, subtitle, href, color, icon, \"order\", active FROM featured_banners WHERE active = 1 ORDER BY \"order\" ASC")
      return rows.map(r => ({
        id:       r.id,
        tag:      r.tag,
        title:    r.title,
        subtitle: r.subtitle,
        href:     r.href,
        color:    r.color,
        icon:     r.icon,
        order:    r.order,
        active:   !!r.active,
      } as FeaturedBanner))
    }, callback as any, 120_000) // banners rarely change — poll every 2 min
  },

  subscribeToUsers(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM users ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToListings(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM listings ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToOrders(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM orders ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToDisputes(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM disputes ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToWithdrawals(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM withdrawals ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToSubscriptions(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM subscriptions ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToBoosts(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM boosts ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToPendingPayouts(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM payout_requests WHERE status = 'pending' ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToPendingReports(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM reports WHERE status = 'pending' ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToSearchAlerts(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM search_alerts ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToActiveBundles(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM bundles WHERE is_active = 1 ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToVerificationRequests(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM verification_requests ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToPayoutRequests(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM payout_requests ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToNotifications(userId, callback) {
    // FIX: was 15s — notifications use Supabase broadcast for instant delivery
    // so polling is just a fallback. 60s is fine.
    return poll(
      async () => (await d1Query(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        [userId]
      )).map(rowToDoc),
      callback as any,
      60_000,
    )
  },

  subscribeToChat(chatId, callback) {
    // FIX: was 5s — chat uses Supabase broadcast for instant delivery.
    // 15s polling is a safe fallback without hammering D1.
    return poll(
      async () => (await d1Query(
        "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC LIMIT 200",
        [chatId]
      )).map(rowToDoc),
      callback as any,
      15_000,
    )
  },

  subscribeToUserChats(userId, callback) {
    // FIX: was 10s → 30s. Broadcast handles new message badges instantly.
    return poll(
      async () => (await d1Query(
        "SELECT * FROM chats WHERE buyer_id = ? OR seller_id = ? ORDER BY updated_at DESC LIMIT 50",
        [userId, userId]
      )).map(rowToDoc),
      callback as any,
      30_000,
    )
  },

  subscribeToCollection(path, callback, constraints) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const { sql, vals } = buildSelectQuery(table, constraints)
    return poll(
      async () => (await d1Query(sql, vals)).map(rowToDoc),
      callback as any,
      60_000,
      () => { try { (callback as any)([]) } catch { /* ignore */ } },
    )
  },

  subscribeToCollectionWhere(path, field, op, value, callback) {
    const table  = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const col    = field.replace(/([A-Z])/g, "_$1").toLowerCase()
    const sqlOp  = op === "==" ? "=" : op
    return poll(
      async () => (await d1Query(`SELECT * FROM ${table} WHERE ${col} ${sqlOp} ? ORDER BY created_at DESC`, [value])).map(rowToDoc),
      callback as any,
      60_000,
      () => { try { (callback as any)([]) } catch { /* ignore */ } },
    )
  },

  subscribeToDoc(path, docId, callback, onError) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const pk    = pkColumn(table)
    return poll(async () => {
      try {
        const rows = await d1Query(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`, [docId])
        callback(rows[0] ? rowToDoc(rows[0] as any) : null)
      } catch (err) {
        if (onError) onError(err as Error)
        else callback(null)
      }
      return []
    }, () => {}, 15_000)
  },

  // ── One-shot read/write methods ───────────────────────────────

  _ref_(path, constraints) {
    return { _collection: path, _constraints: constraints ?? [] } as any
  },

  async getCollection(path, constraints) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const { sql, vals } = buildSelectQuery(table, constraints)
    try {
      const rows = await d1Query(sql, vals)
      return rows.map(r => rowToDoc(r as any))
    } catch {
      return []
    }
  },

  async updateDoc(collectionPath, docId, data) {
    const table = collectionPath.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const now   = new Date().toISOString()
    const sets: string[] = ["updated_at = ?"]
    const vals: unknown[] = [now]

    for (const [k, v] of Object.entries(data)) {
      if (k === "updatedAt") continue
      const col = k.replace(/([A-Z])/g, "_$1").toLowerCase()
      sets.push(`${col} = ?`)
      vals.push(typeof v === "boolean" ? (v ? 1 : 0) : v)
    }

    vals.push(docId)
    await d1Query(`UPDATE ${table} SET ${sets.join(", ")} WHERE ${pkColumn(table)} = ?`, vals)
  },

  async addDoc(collectionPath, data) {
    const table = collectionPath.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const id    = crypto.randomUUID()
    const now   = new Date().toISOString()

    const cols: string[] = ["id", "created_at", "updated_at"]
    const placeholders:  string[] = ["?", "?", "?"]
    const vals: unknown[] = [id, now, now]

    for (const [k, v] of Object.entries(data)) {
      if (["createdAt","updatedAt"].includes(k)) continue
      const col = k.replace(/([A-Z])/g, "_$1").toLowerCase()
      cols.push(col)
      placeholders.push("?")
      vals.push(typeof v === "boolean" ? (v ? 1 : 0) : v)
    }

    await d1Query(
      `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders.join(",")})`,
      vals,
    )
    return { id }
  },

  async deleteDoc(collectionPath, docId) {
    const table = collectionPath.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    await d1Query(`DELETE FROM ${table} WHERE ${pkColumn(table)} = ?`, [docId])
  },

  async setDoc(collectionPath, docId, data, options) {
    if (collectionPath === "config") {
      const existing = await kvGet(docId)
      if (options?.merge && existing) {
        await kvSet(docId, { ...existing, ...data })
      } else {
        await kvSet(docId, data)
      }
      return
    }

    const table = collectionPath.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const pk    = pkColumn(table)
    const now   = new Date().toISOString()

    // created_at only exists on tables keyed by "id" — wallet-style tables
    // keyed by user_id/agent_id/month don't have it.
    const cols: string[] = pk === "id" ? ["id", "created_at", "updated_at"] : [pk, "updated_at"]
    const placeholders: string[] = pk === "id" ? ["?", "?", "?"] : ["?", "?"]
    const vals: unknown[] = pk === "id" ? [docId, now, now] : [docId, now]
    const updateSets: string[] = ["updated_at = ?"]
    const updateVals: unknown[] = [now]

    for (const [k, v] of Object.entries(data)) {
      if (["createdAt","updatedAt"].includes(k)) continue
      const col = k.replace(/([A-Z])/g, "_$1").toLowerCase()
      cols.push(col)
      placeholders.push("?")
      const sqlVal = typeof v === "boolean" ? (v ? 1 : 0) : v
      vals.push(sqlVal)
      updateSets.push(`${col} = ?`)
      updateVals.push(sqlVal)
    }

    if (options?.merge) {
      await d1Query(
        `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders.join(",")})
         ON CONFLICT(${pk}) DO UPDATE SET ${updateSets.join(", ")}`,
        [...vals, ...updateVals],
      )
    } else {
      await d1Query(
        `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${placeholders.join(",")})`,
        vals,
      )
    }
  },

  async getDoc(collectionPath, docId) {
    if (collectionPath === "config") {
      return kvGet(docId) as any
    }

    const table = collectionPath.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    try {
      const rows  = await d1Query(`SELECT * FROM ${table} WHERE ${pkColumn(table)} = ? LIMIT 1`, [docId])
      if (!rows[0]) return null
      return rowToDoc(rows[0] as any)
    } catch {
      return null
    }
  },

  generateId() {
    return crypto.randomUUID()
  },

  batch() {
    const ops: Array<() => Promise<void>> = []
    return {
      set:    (ref: any, data: any) => { ops.push(() => AdminService.setDoc(ref._path, ref._id, data)); return null as any },
      update: (ref: any, data: any) => { ops.push(() => AdminService.updateDoc(ref._path, ref._id, data)); return null as any },
      delete: (ref: any)            => { ops.push(() => AdminService.deleteDoc(ref._path, ref._id)); return null as any },
      commit: async () => { for (const op of ops) await op() },
    } as any
  },
}
