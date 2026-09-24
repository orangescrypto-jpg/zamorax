// lib/cleanup/archive.ts
// Archive-then-delete for money records (orders, wallet transactions).
//
// The contract, enforced here rather than trusted to each caller:
//   1. Rows are written to an R2 file as JSON.
//   2. The file is READ BACK and compared with what was written
//      (row count, the exact id list, and a checksum).
//   3. Only if every check passes does archiveRows() return the ids that
//      are now safe to delete from D1.
// If any step fails it returns an empty list, so nothing is ever deleted
// without a verified copy. Files are grouped one per calendar month
// (archive/orders/2026-09.json) so R2 does not fill with tiny files and an
// old record can be looked up by month.
import { r2Get, r2Put } from "@/lib/r2/client"

export type ArchiveKind = "orders" | "transactions"

export interface ArchiveFile {
  kind: ArchiveKind
  month: string // YYYY-MM
  version: 1
  updatedAt: string
  count: number
  rows: Array<Record<string, unknown> & { id: string }>
}

/** "2026-09" from any ISO-ish timestamp, or "unknown" if it cannot be read. */
export function monthOf(ts: unknown): string {
  if (typeof ts !== "string") return "unknown"
  const m = /^(\d{4})-(\d{2})/.exec(ts)
  return m ? `${m[1]}-${m[2]}` : "unknown"
}

export function archiveKey(kind: ArchiveKind, month: string): string {
  return `archive/${kind}/${month}.json`
}

/** Small, stable checksum (djb2) of the id list. Detects a truncated or altered file. */
export function idChecksum(ids: string[]): string {
  const s = [...ids].sort().join("|")
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

async function readArchive(
  key: string,
  nativeBucket?: unknown,
): Promise<ArchiveFile | null> {
  try {
    const buf = await r2Get(key, nativeBucket)
    if (!buf) return null
    const text = new TextDecoder().decode(buf)
    const parsed = JSON.parse(text) as ArchiveFile
    return Array.isArray(parsed?.rows) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Merges `rows` into the monthly archive file (existing rows are kept, a row
 * already present is replaced so a re-run is harmless), writes it, reads it
 * back, and verifies every id landed. Returns the ids that are safe to
 * delete from D1 - all of them, or none.
 */
export async function archiveRows(
  kind: ArchiveKind,
  month: string,
  rows: Array<Record<string, unknown> & { id: string }>,
  nativeBucket?: unknown,
): Promise<{ safeIds: string[]; note: string | null }> {
  if (rows.length === 0) return { safeIds: [], note: null }

  const key = archiveKey(kind, month)
  try {
    const existing = await readArchive(key, nativeBucket)
    const byId = new Map<string, Record<string, unknown> & { id: string }>()
    for (const r of existing?.rows ?? []) byId.set(String(r.id), r)
    for (const r of rows) byId.set(String(r.id), r)

    const merged = [...byId.values()]
    const file: ArchiveFile = {
      kind,
      month,
      version: 1,
      updatedAt: new Date().toISOString(),
      count: merged.length,
      rows: merged,
    }
    const body = new TextEncoder().encode(JSON.stringify(file))
    await r2Put(key, body, "application/json", nativeBucket)

    // ── Verify: read it back and compare against what we meant to store ──
    const back = await readArchive(key, nativeBucket)
    if (!back) return { safeIds: [], note: `archive ${key} could not be read back` }
    if (back.count !== merged.length || back.rows.length !== merged.length) {
      return { safeIds: [], note: `archive ${key} row count mismatch after write` }
    }
    const wantIds = merged.map((r) => String(r.id))
    const gotIds = back.rows.map((r) => String(r.id))
    if (idChecksum(wantIds) !== idChecksum(gotIds)) {
      return { safeIds: [], note: `archive ${key} checksum mismatch after write` }
    }
    const gotSet = new Set(gotIds)
    const ids = rows.map((r) => String(r.id))
    if (!ids.every((id) => gotSet.has(id))) {
      return { safeIds: [], note: `archive ${key} is missing rows we just wrote` }
    }
    return { safeIds: ids, note: null }
  } catch (err) {
    console.error(`[cleanup] archive ${key} failed, nothing will be deleted:`, err)
    return { safeIds: [], note: `archive ${key} failed: ${(err as Error).message}` }
  }
}

/** Looks up one archived row by id, scanning the given months (newest first). */
export async function findArchived(
  kind: ArchiveKind,
  id: string,
  months: string[],
  nativeBucket?: unknown,
): Promise<{ month: string; row: Record<string, unknown> } | null> {
  for (const month of months) {
    const file = await readArchive(archiveKey(kind, month), nativeBucket)
    const hit = file?.rows.find((r) => String(r.id) === id)
    if (hit) return { month, row: hit }
  }
  return null
}
