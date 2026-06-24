// lib/db/shims.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
// Compatibility shims exported from @/src/services so that files
// which still use Firestore helpers don't break during migration.
// These are no-ops or simple stubs — replace call-by-call with
// real D1 queries as you migrate each page/component.
// ─────────────────────────────────────────────────────────────────

// ── Type shims ───────────────────────────────────────────────────
export type QueryConstraint  = unknown
export type DocumentSnapshot = { id: string; data: () => Record<string, unknown>; exists: () => boolean }
export type DocumentData     = Record<string, unknown>

// ── Value shims ───────────────────────────────────────────────────
export const serverTimestamp = () => new Date().toISOString()

export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number) {}
  toDate() { return new Date(this.seconds * 1000) }
  toMillis() { return this.seconds * 1000 }
  static now() { return new Timestamp(Math.floor(Date.now() / 1000), 0) }
  static fromDate(d: Date) { return new Timestamp(Math.floor(d.getTime() / 1000), 0) }
}

export const arrayUnion = (...items: unknown[]) => ({ _type: "arrayUnion", items })
export const arrayRemove = (...items: unknown[]) => ({ _type: "arrayRemove", items })
export const increment = (n: number) => ({ _type: "increment", n })

// ── Query builder shims (no-ops — replaced per-file with D1) ─────
export const where     = (field: string, op: string, value: unknown) => ({ field, op, value })
export const orderBy   = (field: string, dir?: string) => ({ field, dir })
export const limit     = (n: number) => ({ limit: n })
export const query     = (...args: unknown[]) => ({ _query: args })
export const collection = (db: unknown, path: string) => ({ _collection: path })
export const doc       = (db: unknown, ...pathSegments: string[]) => ({
  _collection: pathSegments.slice(0, -1).join("/"),
  _id:         pathSegments[pathSegments.length - 1],
  _path:       pathSegments.slice(0, -1).join("/"),
})

// ── CRUD shims (redirect to AdminService) ────────────────────────
// These call AdminService under the hood so nothing breaks.
// Gradually replace with direct D1 API calls.
import { AdminService } from "@/src/services/admin"

export const getDoc = async (ref: any) => {
  const data = await AdminService.getDoc(ref._collection, ref._id)
  return {
    id: ref._id,
    exists: () => !!data,
    data: () => data ?? {},
  } as DocumentSnapshot
}

export const getDocs = async (q: any) => {
  const path = q._collection ?? q._query?.[0]?._collection ?? ""
  const rows = await AdminService.getCollection(path)
  return {
    docs:  rows.map(r => ({ id: r.id, data: () => r, exists: () => true })),
    empty: rows.length === 0,
    size:  rows.length,
  }
}

export const addDoc = async (ref: any, data: Record<string, unknown>) => {
  return AdminService.addDoc(ref._collection, data)
}

export const updateDoc = async (ref: any, data: Record<string, unknown>) => {
  return AdminService.updateDoc(ref._collection, ref._id, data)
}

export const deleteDoc = async (ref: any) => {
  return AdminService.deleteDoc(ref._collection, ref._id)
}

export const setDoc = async (ref: any, data: Record<string, unknown>, options?: { merge?: boolean }) => {
  return AdminService.setDoc(ref._collection, ref._id, data, options)
}

export const writeBatch = () => AdminService.batch()

// ── onSnapshot shim (poll-based) ─────────────────────────────────
// WAS: realtime push
// NOW: poll every 30s — TODO: Durable Objects realtime later
export const onSnapshot = (
  queryOrRef: any,
  callback: (snap: any) => void,
  _onError?: (e: Error) => void,
): (() => void) => {
  const path = queryOrRef._collection ?? queryOrRef._query?.[0]?._collection ?? ""

  let active = true
  const run  = async () => {
    if (!active) return
    try {
      const rows = await AdminService.getCollection(path)
      callback({
        docs:  rows.map(r => ({ id: r.id, data: () => r, exists: () => true })),
        empty: rows.length === 0,
        size:  rows.length,
      })
    } catch { /* ignore */ }
    if (active) setTimeout(run, 30_000)
  }
  run()
  return () => { active = false }
}
