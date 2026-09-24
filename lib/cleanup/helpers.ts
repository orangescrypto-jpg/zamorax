// lib/cleanup/helpers.ts
// Shared building blocks for every cleanup job. The rules baked in here:
//
//  1. Never depend on a "rows changed" count. On the Cloudflare native
//     binding, d1Query drops that metadata. Every delete therefore works
//     from an explicit list of ids that we SELECTed first, and the count we
//     report is the size of that list.
//  2. D1 allows at most 100 bound parameters per statement, so id lists are
//     chunked (CHUNK = 80, leaving headroom for extra bound values).
//  3. Every job is bounded per run so one invocation stays inside a
//     Worker's time budget. A job that hits the bound reports
//     `complete: false` and simply continues on the next run.
//  4. Every table/column is checked to exist before use. If the live
//     database differs from the schema file (it does, in places), the job
//     reports "skipped" instead of failing halfway.
import { d1Query } from "@/lib/d1"
import { r2Delete, R2_PUBLIC_URL } from "@/lib/r2/client"
import { JOB_BY_KEY, toDays, type JobKey } from "@/lib/cleanup/settings"

export const CHUNK = 80
/** Max rows one job handles per run; keeps a single invocation short. */
export const MAX_ROWS_PER_RUN = 2000

export interface JobResult {
  key: JobKey
  label: string
  /** Rows removed from D1 (or, for archive jobs, rows archived AND removed). */
  deleted: number
  /** R2 files removed. */
  filesDeleted: number
  /** Rows that were eligible but deliberately skipped by a safety rule. */
  protectedSkipped: number
  /** false when the per-run cap was hit and more remains. */
  complete: boolean
  /** true when the job did nothing because its setting is 0. */
  disabled: boolean
  /** Set when a table/column was missing or a step failed. */
  note: string | null
  /** True for a preview: nothing was changed. */
  dryRun: boolean
}

export function emptyResult(key: JobKey, dryRun: boolean): JobResult {
  return {
    key,
    label: JOB_BY_KEY[key].label,
    deleted: 0,
    filesDeleted: 0,
    protectedSkipped: 0,
    complete: true,
    disabled: false,
    note: null,
    dryRun,
  }
}

/** ISO cutoff for "older than N (days|months)" for the given job's stored value. */
export function cutoffFor(job: JobKey, value: number, now = Date.now()): string {
  return new Date(now - toDays(job, value) * 86_400_000).toISOString()
}

export function chunk<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ")
}

/** Reads rows; always returns an array (never undefined). */
export async function selectRows<T = Record<string, unknown>>(
  sql: string,
  params: unknown[],
  nativeDB?: unknown,
): Promise<T[]> {
  const res = await d1Query(sql, params, nativeDB)
  return ((res?.results ?? []) as T[]) || []
}

/** Deletes exactly the given ids from a table, in chunks. Returns how many ids were sent. */
export async function deleteByIds(
  table: string,
  idColumn: string,
  ids: string[],
  nativeDB?: unknown,
): Promise<number> {
  let n = 0
  for (const part of chunk(ids)) {
    await d1Query(`DELETE FROM ${table} WHERE ${idColumn} IN (${placeholders(part.length)})`, part, nativeDB)
    n += part.length
  }
  return n
}

// ── Schema guards ─────────────────────────────────────────────────────

const colCache = new Map<string, Set<string>>()

/** Columns that really exist on the live table (empty set if the table is missing). */
export async function liveColumns(table: string, nativeDB?: unknown): Promise<Set<string>> {
  const hit = colCache.get(table)
  if (hit) return hit
  const set = new Set<string>()
  try {
    // PRAGMA cannot bind a table name, so the name is checked first.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) return set
    const rows = await selectRows<{ name: string }>(`PRAGMA table_info(${table})`, [], nativeDB)
    for (const r of rows) set.add(String(r.name))
  } catch {
    /* table missing or PRAGMA unavailable: leave empty */
  }
  colCache.set(table, set)
  return set
}

/** Returns a note describing what is missing, or null when everything exists. */
export async function missingSchema(
  table: string,
  columns: string[],
  nativeDB?: unknown,
): Promise<string | null> {
  const cols = await liveColumns(table, nativeDB)
  if (cols.size === 0) return `table "${table}" not found`
  const missing = columns.filter((c) => !cols.has(c))
  return missing.length ? `"${table}" is missing column(s): ${missing.join(", ")}` : null
}

export function resetSchemaCache() {
  colCache.clear()
}

// ── R2 key handling ───────────────────────────────────────────────────

/**
 * Every folder the app writes under (see the upload paths in the code:
 * StorageService.uploadFile callers, /api/upload and /api/buyback/upload).
 * A stored value only counts as one of our files when it starts with one of
 * these, so an external URL or a malformed value can never lead to a delete.
 *
 * If a new feature uploads to a new folder, add it here. Until it is added,
 * files in that folder are treated as UNKNOWN: the orphan sweep only ever
 * removes files under a prefix listed here, so an unlisted folder is left
 * completely alone rather than being deleted by mistake.
 */
export const KNOWN_PREFIXES = [
  "listings/",
  "buyback/",
  "blog/",
  "banners/",
  "featured-banners/",
  "site-banners/",
  "payment-proofs/",
  "payout-proofs/",
  "disputes/",
  "verifications/",
  "orders/",
  "returns/",
  "stores/",
  "uploads/",
  "archive/",
]

/** True when the key is under a folder this cleanup knows how to reason about. */
export function isKnownKey(key: string): boolean {
  return KNOWN_PREFIXES.some((p) => key.startsWith(p))
}

/**
 * Turns a stored URL or key into an R2 key, or null when it is not one of
 * ours. Only keys under a known prefix are ever returned, so an external
 * image URL, or a malformed value, can never lead to a delete.
 */
export function toR2Key(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null
  let key = value.trim()
  let base = ""
  try {
    base = R2_PUBLIC_URL()
  } catch {
    base = ""
  }
  if (base && key.startsWith(base)) key = key.slice(base.length)
  else if (/^https?:\/\//i.test(key)) return null // someone else's URL
  key = key.replace(/^\/+/, "").split("?")[0].split("#")[0]
  if (!key || key.includes("..")) return null
  return isKnownKey(key) ? key : null
}

/** Pulls every R2 key out of a JSON array string, a plain URL, or free text. */
export function extractKeys(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.flatMap(extractKeys)
  if (typeof raw !== "string") return []
  const s = raw.trim()
  if (!s) return []
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s)
      return extractKeys(Array.isArray(parsed) ? parsed : Object.values(parsed))
    } catch {
      /* fall through to plain handling */
    }
  }
  const k = toR2Key(s)
  return k ? [k] : []
}

/** Best-effort file delete: never throws, returns how many were removed. */
export async function deleteFiles(keys: string[], nativeBucket?: unknown): Promise<number> {
  let n = 0
  for (const key of new Set(keys)) {
    try {
      await r2Delete(key, nativeBucket)
      n++
    } catch (err) {
      console.error(`[cleanup] could not delete R2 file ${key} (non-fatal):`, err)
    }
  }
  return n
}
