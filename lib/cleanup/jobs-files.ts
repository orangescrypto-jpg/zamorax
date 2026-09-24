// lib/cleanup/jobs-files.ts
// File-related jobs: unused image-library rows, orphan R2 files, and rows
// left behind by deleted users.
//
// THE ORPHAN SWEEP IS THE MOST DANGEROUS JOB HERE, so it is built around one
// principle: never trust a fixed list of "columns that hold images". The
// live database differs from the schema file, and new features add new
// columns. Instead the sweep discovers references by scanning EVERY text
// column of EVERY table for anything that looks like one of our R2 keys.
// A file is only deleted when it appears nowhere at all.
import { r2Delete } from "@/lib/r2/client"
import {
  MAX_ROWS_PER_RUN,
  chunk,
  deleteByIds,
  deleteFiles,
  emptyResult,
  extractKeys,
  isKnownKey,
  liveColumns,
  missingSchema,
  placeholders,
  selectRows,
  toR2Key,
  type JobResult,
} from "@/lib/cleanup/helpers"
import type { Ctx } from "@/lib/cleanup/jobs-basic"
import { d1Query } from "@/lib/d1"

/** Tables that store our own bookkeeping, never file references. Skipped in the scan for speed. */
const SKIP_TABLES = new Set([
  "sqlite_sequence",
  "_cf_KV",
  "d1_migrations",
  "rate_limits",
  "kv_store",
  "cron_settings",
  "push_vapid_keys",
])

/** Free-text columns that can contain image links inside larger text (blog bodies, descriptions). */
const BODY_COLUMN_HINTS = ["content", "description", "body", "message", "details"]

export interface ReferenceScan {
  keys: Set<string>
  tablesScanned: number
  columnsScanned: number
  /** Tables that could not be read; if any, the sweep must NOT delete. */
  failures: string[]
}

/** Every table in the database, straight from the engine (not from a hand-written list). */
export async function allTables(nativeDB?: unknown): Promise<string[]> {
  const rows = await selectRows<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
    [],
    nativeDB,
  )
  return rows.map((r) => String(r.name)).filter((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !SKIP_TABLES.has(n))
}

/**
 * Collects every R2 key referenced anywhere in the database. For each table
 * it reads all text columns in pages. A `failures` entry means a table could
 * not be scanned, in which case the caller must refuse to delete anything.
 */
export async function scanAllReferences(nativeDB?: unknown, maxRowsPerTable = 200_000): Promise<ReferenceScan> {
  const scan: ReferenceScan = { keys: new Set(), tablesScanned: 0, columnsScanned: 0, failures: [] }
  const tables = await allTables(nativeDB)
  for (const table of tables) {
    try {
      const info = await selectRows<{ name: string; type: string }>(`PRAGMA table_info(${table})`, [], nativeDB)
      // TEXT-ish columns only; numbers cannot contain a file path.
      const cols = info
        .filter((c) => !/INT|REAL|NUM|FLOA|DOUB|BOOL/i.test(String(c.type || "")))
        .map((c) => String(c.name))
        .filter((c) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(c))
      if (cols.length === 0) continue
      scan.tablesScanned++
      scan.columnsScanned += cols.length

      const pageSize = 1000
      let offset = 0
      while (offset < maxRowsPerTable) {
        const rows = await selectRows<Record<string, unknown>>(
          `SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${table}" LIMIT ? OFFSET ?`,
          [pageSize, offset],
          nativeDB,
        )
        for (const row of rows) {
          for (const c of cols) {
            const v = row[c]
            if (typeof v !== "string" || v.length < 6) continue
            // Cheap pre-filter: skip values that cannot possibly hold a key.
            if (!v.includes("/")) continue
            for (const k of findKeysInText(v)) scan.keys.add(k)
          }
        }
        if (rows.length < pageSize) break
        offset += pageSize
      }
      if (offset >= maxRowsPerTable) scan.failures.push(`${table}: too large to scan fully`)
    } catch (err) {
      scan.failures.push(`${table}: ${(err as Error).message}`)
    }
  }
  return scan
}

const KEY_PATTERN =
  /(?:listings|buyback|blog|banners|featured-banners|site-banners|payment-proofs|disputes|verifications|orders|returns|stores|uploads)\/[A-Za-z0-9_\-./%+()]+?\.[A-Za-z0-9]{2,5}|(?:stores)\/[A-Za-z0-9_\-./%]+/g

/** Finds R2 keys inside any string: a bare key, a public URL, a JSON array, or HTML. */
export function findKeysInText(text: string): string[] {
  const out = new Set<string>()
  for (const k of extractKeys(text)) out.add(k)
  for (const m of text.matchAll(KEY_PATTERN)) {
    const k = toR2Key(decodeURIComponentSafe(m[0]))
    if (k) out.add(k)
    // Also keep the raw form, in case the stored key contains encoded characters.
    const raw = toR2Key(m[0])
    if (raw) out.add(raw)
  }
  return [...out]
}

/** True when the key, in raw or decoded form, appears in the referenced set. */
export function isReferenced(bucketKey: string, referenced: Set<string>): boolean {
  if (referenced.has(bucketKey)) return true
  const decoded = decodeURIComponentSafe(bucketKey)
  if (decoded !== bucketKey && referenced.has(decoded)) return true
  return false
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

// ── R2 listing (S3 API fallback or native binding) ───────────────────
export interface StoredObject {
  key: string
  size: number
  uploaded: Date
}

async function listBucket(nativeBucket: unknown, maxObjects = 20_000): Promise<StoredObject[] | null> {
  const b = nativeBucket as
    | { list?: (o: { cursor?: string; limit?: number }) => Promise<{ objects: Array<{ key: string; size: number; uploaded: Date }>; truncated: boolean; cursor?: string }> }
    | undefined
  if (b && typeof b.list === "function") {
    const all: StoredObject[] = []
    let cursor: string | undefined
    do {
      const page = await b.list({ cursor, limit: 1000 })
      for (const o of page.objects) all.push({ key: o.key, size: o.size, uploaded: o.uploaded })
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor && all.length < maxObjects)
    return all
  }
  // S3-compatible fallback (local dev / Vercel): needs the same R2 env vars the app already uses.
  try {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3")
    const { r2Client, R2_BUCKET } = await import("@/lib/r2/client")
    const all: StoredObject[] = []
    let token: string | undefined
    do {
      const res: any = await r2Client().send(
        new ListObjectsV2Command({ Bucket: R2_BUCKET(), ContinuationToken: token, MaxKeys: 1000 }),
      )
      for (const o of res.Contents ?? []) {
        all.push({ key: String(o.Key), size: Number(o.Size ?? 0), uploaded: o.LastModified ?? new Date(0) })
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token && all.length < maxObjects)
    return all
  } catch (err) {
    console.error("[cleanup] cannot list R2 bucket:", err)
    return null
  }
}

// ── Orphan files ─────────────────────────────────────────────────────
const MAX_DELETE_FRACTION = 0.5
const MIN_OBJECTS_FOR_FRACTION_CHECK = 20

export interface OrphanReport extends JobResult {
  scanned: number
  referenced: number
  orphaned: number
  orphanedBytes: number
  skippedTooRecent: number
  sample: string[]
}

export async function jobOrphanFiles(minAgeDays: number, ctx: Ctx): Promise<OrphanReport> {
  const base = emptyResult("orphanFiles", ctx.dryRun)
  const report: OrphanReport = {
    ...base,
    scanned: 0,
    referenced: 0,
    orphaned: 0,
    orphanedBytes: 0,
    skippedTooRecent: 0,
    sample: [],
  }

  const objects = await listBucket(ctx.nativeBucket)
  if (!objects) return { ...report, note: "Could not list the R2 bucket, so nothing was checked." }

  const scan = await scanAllReferences(ctx.nativeDB)
  // If any table could not be read, we cannot prove a file is unused. Stop.
  if (scan.failures.length > 0) {
    return { ...report, scanned: objects.length, note: `Refused to run: could not read ${scan.failures.join("; ")}` }
  }

  const graceMs = Math.max(2, minAgeDays) * 86_400_000
  const nowMs = new Date(ctx.nowIso).getTime()
  const orphans: StoredObject[] = []
  for (const o of objects) {
    // Archives are our own records. They are never orphans.
    if (o.key.startsWith("archive/")) continue
    // A folder this code does not know about is left completely alone. It may
    // belong to a feature added later; only folders we understand are swept.
    if (!isKnownKey(o.key)) continue
    // A bucket key counts as referenced if EITHER its raw or its decoded form
    // was found in the database. File names come from the uploader's own
    // file name, so one may hold a literal "%20" while the database holds a
    // space (or the reverse); comparing in both encodings closes that gap.
    if (isReferenced(o.key, scan.keys)) continue
    if (nowMs - o.uploaded.getTime() < graceMs) {
      report.skippedTooRecent++
      continue
    }
    orphans.push(o)
  }

  const considered = objects.filter((o) => !o.key.startsWith("archive/") && isKnownKey(o.key)).length
  report.scanned = considered
  report.referenced = considered - orphans.length - report.skippedTooRecent
  report.orphaned = orphans.length
  report.orphanedBytes = orphans.reduce((s, o) => s + o.size, 0)
  report.sample = orphans.slice(0, 10).map((o) => o.key)
  report.deleted = ctx.dryRun ? 0 : 0
  report.complete = true

  if (ctx.dryRun || orphans.length === 0) return report

  // Tripwire: a huge share of the bucket looking orphaned almost always means
  // the reference scan missed something. Deleting on a bad scan is permanent.
  if (considered >= MIN_OBJECTS_FOR_FRACTION_CHECK && orphans.length / considered > MAX_DELETE_FRACTION) {
    return {
      ...report,
      note: `Refused to delete ${orphans.length} of ${considered} files (over ${MAX_DELETE_FRACTION * 100}%). This usually means something is missing from the reference scan. Run Preview and check before deleting.`,
    }
  }

  const batch = orphans.slice(0, MAX_ROWS_PER_RUN)
  report.complete = batch.length === orphans.length
  let n = 0
  for (const o of batch) {
    try {
      await r2Delete(o.key, ctx.nativeBucket)
      n++
    } catch (err) {
      console.error(`[cleanup] orphan delete failed for ${o.key}:`, err)
    }
  }
  report.deleted = n
  report.filesDeleted = n
  return report
}

// ── Image library ────────────────────────────────────────────────────
// A media_library row is "unused" when its file is referenced nowhere except
// the library row itself. The reference scan is reused, with the library's
// own table excluded so a row cannot count as using itself.
export async function jobMediaLibrary(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("mediaLibrary", ctx.dryRun)
  const miss = await missingSchema("media_library", ["id", "url", "created_at"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }

  const rows = await selectRows<{ id: string; url: string; path: string | null }>(
    `SELECT id, url, path FROM media_library WHERE created_at < ? LIMIT ?`,
    [cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN
  if (rows.length === 0) return r

  const scan = await scanAllReferences(ctx.nativeDB, 200_000)
  if (scan.failures.length > 0) return { ...r, note: `Refused to run: could not read ${scan.failures.join("; ")}` }

  // Count how often each key is referenced OUTSIDE media_library.
  const usedOutside = await keysReferencedOutside("media_library", ctx.nativeDB)
  const unused = rows.filter((row) => {
    const keys = [...extractKeys(row.path), ...extractKeys(row.url)]
    return keys.length > 0 && keys.every((k) => !usedOutside.has(k))
  })
  r.protectedSkipped = rows.length - unused.length
  if (ctx.dryRun) {
    r.deleted = unused.length
    r.filesDeleted = new Set(unused.flatMap((u) => [...extractKeys(u.path), ...extractKeys(u.url)])).size
    return r
  }
  r.filesDeleted = await deleteFiles(unused.flatMap((u) => [...extractKeys(u.path), ...extractKeys(u.url)]), ctx.nativeBucket)
  r.deleted = await deleteByIds("media_library", "id", unused.map((u) => u.id), ctx.nativeDB)
  return r
}

async function keysReferencedOutside(excludeTable: string, nativeDB?: unknown): Promise<Set<string>> {
  const keys = new Set<string>()
  for (const table of await allTables(nativeDB)) {
    if (table === excludeTable) continue
    const info = await selectRows<{ name: string; type: string }>(`PRAGMA table_info(${table})`, [], nativeDB)
    const cols = info
      .filter((c) => !/INT|REAL|NUM|FLOA|DOUB|BOOL/i.test(String(c.type || "")))
      .map((c) => String(c.name))
      .filter((c) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(c))
    if (cols.length === 0) continue
    let offset = 0
    for (;;) {
      const rows = await selectRows<Record<string, unknown>>(
        `SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${table}" LIMIT ? OFFSET ?`,
        [1000, offset],
        nativeDB,
      )
      for (const row of rows) {
        for (const c of cols) {
          const v = row[c]
          if (typeof v === "string" && v.includes("/")) for (const k of findKeysInText(v)) keys.add(k)
        }
      }
      if (rows.length < 1000) break
      offset += 1000
    }
  }
  return keys
}

// ── Leftovers of deleted users ───────────────────────────────────────
// Rows that point at a user id that no longer exists. Only harmless
// personal-convenience tables are touched. Financial tables are never here.
const USER_TABLES: Array<{ table: string; col: string }> = [
  { table: "notifications", col: "user_id" },
  { table: "saved_listings", col: "user_id" },
  { table: "search_alerts", col: "user_id" },
  { table: "push_subscriptions", col: "user_id" },
  { table: "seller_follows", col: "follower_id" },
  { table: "media_library", col: "user_id" },
]

export async function jobDeletedUserLeftovers(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("deletedUserLeftovers", ctx.dryRun)
  const missUsers = await missingSchema("users", ["uid"], ctx.nativeDB)
  if (missUsers) return { ...r, note: missUsers }
  const notes: string[] = []
  let total = 0
  let files = 0
  for (const { table, col } of USER_TABLES) {
    const cols = await liveColumns(table, ctx.nativeDB)
    if (!cols.has("id") || !cols.has(col) || !cols.has("created_at")) {
      if (cols.size > 0) notes.push(`${table}: skipped (needs id, ${col}, created_at)`)
      continue
    }
    const selectFiles = table === "media_library" && cols.has("path") && cols.has("url") ? ", path, url" : ""
    const rows = await selectRows<{ id: string; path?: string; url?: string }>(
      `SELECT t.id${selectFiles ? ", t.path, t.url" : ""} FROM ${table} t
        LEFT JOIN users u ON u.uid = t.${col}
        WHERE u.uid IS NULL AND t.created_at < ?
        LIMIT ?`,
      [cutoff, MAX_ROWS_PER_RUN],
      ctx.nativeDB,
    )
    if (rows.length >= MAX_ROWS_PER_RUN) r.complete = false
    if (ctx.dryRun) {
      total += rows.length
      continue
    }
    if (selectFiles) files += await deleteFiles(rows.flatMap((x) => [...extractKeys(x.path), ...extractKeys(x.url)]), ctx.nativeBucket)
    total += await deleteByIds(table, "id", rows.map((x) => x.id), ctx.nativeDB)
  }
  r.deleted = total
  r.filesDeleted = files
  r.note = notes.length ? notes.join("; ") : null
  return r
}
