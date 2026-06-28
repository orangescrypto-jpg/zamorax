// src/services/providers/cloudflare/admin.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIRESTORE → NOW CLOUDFLARE D1 (via Cloudflare D1 HTTP REST API)
// Replaces all onSnapshot() calls with fetch + polling pattern.
// TODO: add Durable Objects for realtime later
// ─────────────────────────────────────────────────────────────────

import type { IAdminService, FeaturedBanner } from "@/src/services/admin"
import type { FirestoreDoc } from "@/src/types"

// ── D1 HTTP helper ───────────────────────────────────────────────
// Works on Vercel (server-side) AND Cloudflare Pages (server-side).
// Uses the Cloudflare REST API to query D1.

async function d1Query<T = Record<string, unknown>>(
  sql:    string,
  params: unknown[] = [],
): Promise<T[]> {
  // Browser context: CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN are
  // server-only secrets and are never present in the client bundle. Calling
  // Cloudflare's API directly from here would fail with "Failed to fetch"
  // (CORS / undefined URL segments). Proxy through our own server route instead.
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
    // Next.js: no-store so admin data is always fresh
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

function rowToDoc(row: Record<string, unknown>): FirestoreDoc {
  // Normalise snake_case → camelCase for common fields
  const doc: Record<string, unknown> = { id: row.id ?? row.uid }
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    doc[camel] = v
  }
  // Timestamps
  if (doc.createdAt) doc.createdAt = toIsoOrNull(doc.createdAt)
  if (doc.updatedAt) doc.updatedAt = toIsoOrNull(doc.updatedAt)
  // Boolean coercion (SQLite stores 0/1)
  const boolCols = ["isActive","isBanned","isBoosted","ninVerified","bvnVerified",
                    "phoneVerified","emailVerified","isSellerReady"]
  for (const col of boolCols) if (col in doc) doc[col] = !!doc[col]
  return doc as FirestoreDoc
}

// ── Polling helper (replaces onSnapshot) ─────────────────────────
// WAS: onSnapshot(query, callback)  → realtime push
// NOW: poll every INTERVAL ms       → TODO: Durable Objects realtime later
//
// onError is called with an empty array on the first failure so that
// any loading spinner that only fires inside the callback still resolves.

function poll(
  fetcher:  () => Promise<unknown[]>,
  callback: (docs: unknown[]) => void,
  interval  = 30_000,
  onError?: (err: unknown) => void,
): () => void {
  let active = true

  const run = async () => {
    if (!active) return
    try {
      callback(await fetcher())
    } catch (err) {
      // Call the error handler if provided, otherwise call callback with
      // empty array so loading spinners don't get stuck forever.
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

// ── Shared constraint → SQL builder (used by getCollection + subscribeToCollection) ──
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
      // where(field, op, value) — supports Firestore-style ops used in this codebase
      const col = toCol(c.field === "__name__" ? "id" : c.field)
      if (c.op === "in" && Array.isArray(c.value)) {
        wheres.push(`${col} IN (${c.value.map(() => "?").join(",")})`)
        vals.push(...c.value)
      } else if (c.op === "array-contains") {
        // JSON-array column stored as text — substring match on the quoted value
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
      // orderBy(field, dir)
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

// ── kv_store helpers (used for "config" collection reads/writes) ──
// The old Firestore "config" collection (config/fees, config/email, etc.)
// is stored as JSON blobs in kv_store, keyed as "config:<docId>".
// This avoids needing a dynamic per-field schema in D1.

async function kvGet(docId: string): Promise<Record<string, unknown> | null> {
  try {
    await d1Query(
      `CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
      )`
    )
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
  await d1Query(
    `CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    )`
  )
  const key = `config:${docId}`
  const now = new Date().toISOString()
  const value = JSON.stringify({ ...data, updatedAt: now })
  const existing = await d1Query(`SELECT key FROM kv_store WHERE key = ? LIMIT 1`, [key])
  if (existing[0]) {
    await d1Query(`UPDATE kv_store SET value = ?, updated_at = ? WHERE key = ?`, [value, now, key])
  } else {
    await d1Query(`INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)`, [key, value, now])
  }
}

// ── Implementation ───────────────────────────────────────────────

export const AdminService: IAdminService = {

  // ── Subscribe methods (WAS onSnapshot → NOW poll) ─────────────

  subscribeToFeaturedBanners(callback) {
    return poll(async () => {
      const rows = await d1Query("SELECT * FROM featured_banners WHERE active = 1 ORDER BY \"order\" ASC")
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
    }, callback as any, 60_000)
  },

  subscribeToUsers(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM users ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToListings(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM listings ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToOrders(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM orders ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToDisputes(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM disputes ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToWithdrawals(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM withdrawals ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToSubscriptions(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM subscriptions ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToBoosts(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM boosts ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToPendingPayouts(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM payout_requests WHERE status = 'pending' ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToPendingReports(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM reports WHERE status = 'pending' ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToSearchAlerts(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM search_alerts ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToActiveBundles(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM bundles WHERE is_active = 1 ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToVerificationRequests(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM verification_requests ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToPayoutRequests(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM payout_requests ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToNotifications(userId, callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC", [userId])).map(rowToDoc),
      callback as any,
      15_000,
    )
  },

  subscribeToChat(chatId, callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC", [chatId])).map(rowToDoc),
      callback as any,
      5_000,
    )
  },

  subscribeToUserChats(userId, callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM chats WHERE buyer_id = ? OR seller_id = ? ORDER BY updated_at DESC", [userId, userId])).map(rowToDoc),
      callback as any,
      10_000,
    )
  },

  // ── Generic subscribe — used by most admin pages ───────────────
  // On error: calls callback([]) immediately so loading spinners resolve,
  // then retries on the next poll interval.
  subscribeToCollection(path, callback, constraints) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const { sql, vals } = buildSelectQuery(table, constraints)
    return poll(
      async () => (await d1Query(sql, vals)).map(rowToDoc),
      callback as any,
      30_000,
      // onError: resolve loading with empty array instead of spinning forever
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
      30_000,
      () => { try { (callback as any)([]) } catch { /* ignore */ } },
    )
  },

  subscribeToDoc(path, docId, callback, onError) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    return poll(async () => {
      try {
        const rows = await d1Query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [docId])
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
    // WAS: Firestore query ref for pagination/onSnapshot.
    // NOW: plain descriptor — getCollection()/onSnapshot() shim read
    // `_collection` + `_constraints` off this to build the SQL query.
    return { _collection: path, _constraints: constraints ?? [] } as any
  },

  async getCollection(path, constraints) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const { sql, vals } = buildSelectQuery(table, constraints)
    try {
      const rows = await d1Query(sql, vals)
      return rows.map(r => rowToDoc(r as any))
    } catch {
      // Table doesn't exist yet — return empty array instead of throwing
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
    await d1Query(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, vals)
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
    await d1Query(`DELETE FROM ${table} WHERE id = ?`, [docId])
  },

  async setDoc(collectionPath, docId, data, options) {
    // "config" collection → stored as JSON blobs in kv_store
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
    const now   = new Date().toISOString()

    const cols: string[] = ["id", "created_at", "updated_at"]
    const placeholders: string[] = ["?", "?", "?"]
    const vals: unknown[] = [docId, now, now]
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
         ON CONFLICT(id) DO UPDATE SET ${updateSets.join(", ")}`,
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
    // "config" collection → read from kv_store
    if (collectionPath === "config") {
      return kvGet(docId) as any
    }

    const table = collectionPath.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    try {
      const rows  = await d1Query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [docId])
      if (!rows[0]) return null
      return rowToDoc(rows[0] as any)
    } catch {
      // Table doesn't exist yet
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
