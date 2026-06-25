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

function poll(
  fetcher:  () => Promise<unknown[]>,
  callback: (docs: unknown[]) => void,
  interval  = 30_000,
): () => void {
  let active = true

  const run = async () => {
    if (!active) return
    try { callback(await fetcher()) } catch { /* ignore poll errors */ }
    if (active) setTimeout(run, interval)
  }

  run()
  return () => { active = false }
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

  subscribeToDisputes(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM disputes ORDER BY created_at DESC")).map(rowToDoc),
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

  subscribeToWithdrawals(callback) {
    return poll(
      async () => (await d1Query("SELECT * FROM withdrawals ORDER BY created_at DESC")).map(rowToDoc),
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
      async () => (await d1Query("SELECT * FROM listing_reports WHERE status = 'pending' ORDER BY created_at DESC")).map(rowToDoc),
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
      async () => (await d1Query("SELECT * FROM bundles WHERE status = 'active' ORDER BY created_at DESC")).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToCollection(path, callback, _constraints) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    // TODO: translate QueryConstraints to SQL WHERE — for now fetch all
    return poll(
      async () => (await d1Query(`SELECT * FROM ${table} ORDER BY created_at DESC`)).map(rowToDoc),
      callback,
    )
  },

  subscribeToCollectionWhere(path, field, op, value, callback) {
    const table  = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const col    = field.replace(/([A-Z])/g, "_$1").toLowerCase()
    const sqlOp  = op === "==" ? "=" : op
    return poll(
      async () => (await d1Query(`SELECT * FROM ${table} WHERE ${col} ${sqlOp} ? ORDER BY created_at DESC`, [value])).map(rowToDoc),
      callback as any,
    )
  },

  subscribeToDoc(path, docId, callback) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    return poll(async () => {
      const rows = await d1Query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [docId])
      callback(rows[0] ? rowToDoc(rows[0] as any) : null)
      return []
    }, () => {}, 15_000)
  },

  // ── One-shot read/write methods ───────────────────────────────

  _ref_(_path, _constraints) {
    // Not applicable for D1 — only existed for Firestore pagination
    // Returns a no-op placeholder to satisfy the interface
    return null as any
  },

  async getCollection(path, _constraints) {
    const table = path.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const rows  = await d1Query(`SELECT * FROM ${table} ORDER BY created_at DESC`)
    return rows.map(r => rowToDoc(r as any))
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
      // Upsert — update if exists, else insert
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
    const table = collectionPath.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")
    const rows  = await d1Query(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [docId])
    if (!rows[0]) return null
    return rowToDoc(rows[0] as any)
  },

  generateId() {
    return crypto.randomUUID()
  },

  batch() {
    // D1 doesn't expose WriteBatch through HTTP API in the same way.
    // Return a compatible stub that queues operations and commits via
    // individual calls. For full batch atomicity use wrangler D1 transactions.
    const ops: Array<() => Promise<void>> = []
    return {
      set:    (ref: any, data: any) => { ops.push(() => AdminService.setDoc(ref._path, ref._id, data)); return null as any },
      update: (ref: any, data: any) => { ops.push(() => AdminService.updateDoc(ref._path, ref._id, data)); return null as any },
      delete: (ref: any)            => { ops.push(() => AdminService.deleteDoc(ref._path, ref._id)); return null as any },
      commit: async () => { for (const op of ops) await op() },
    } as any
  },
}
