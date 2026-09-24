// lib/cleanup/jobs-listings.ts
// The four listing jobs. All share one deletion routine, deleteListings(),
// because the safety rules must be identical no matter why a listing was
// picked. A listing is NEVER removed when:
//   - any order exists for it (the order page still shows its details;
//     those are handled by the order archive instead),
//   - a layaway plan references it,
//   - it holds Fulfilled-by-Zamorax stock (is_fbz = 1), or
//   - it has an active boost or open offer.
// Removing a listing also removes its R2 images and verification video,
// its saved-listing rows, and its Q&A, so nothing is left pointing at it.
import {
  MAX_ROWS_PER_RUN,
  chunk,
  deleteByIds,
  deleteFiles,
  emptyResult,
  extractKeys,
  missingSchema,
  placeholders,
  selectRows,
  type JobResult,
} from "@/lib/cleanup/helpers"
import type { JobKey } from "@/lib/cleanup/settings"
import type { Ctx } from "@/lib/cleanup/jobs-basic"
import { d1Query } from "@/lib/d1"

interface ListingRow {
  id: string
  images: string | null
  verification_video: string | null
}

/** Ids among `ids` that must be kept, with the reason. */
export async function protectedListingIds(
  ids: string[],
  nowIso: string,
  nativeDB?: unknown,
): Promise<Set<string>> {
  const prot = new Set<string>()
  for (const part of chunk(ids)) {
    const ph = placeholders(part.length)
    const queries: Array<[string, unknown[]]> = [
      [`SELECT DISTINCT listing_id AS id FROM orders WHERE listing_id IN (${ph})`, part],
      [`SELECT DISTINCT listing_id AS id FROM layaway_plans WHERE listing_id IN (${ph})`, part],
      [`SELECT DISTINCT listing_id AS id FROM boosts WHERE status = 'active' AND listing_id IN (${ph})`, part],
      [`SELECT DISTINCT listing_id AS id FROM adBoosts WHERE status = 'active' AND listing_id IN (${ph})`, part],
      [
        `SELECT DISTINCT listing_id AS id FROM offers
          WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > ?) AND listing_id IN (${ph})`,
        [nowIso, ...part],
      ],
      [`SELECT id FROM listings WHERE is_fbz = 1 AND id IN (${ph})`, part],
    ]
    for (const [sql, params] of queries) {
      try {
        for (const row of await selectRows<{ id: string }>(sql, params, nativeDB)) prot.add(String(row.id))
      } catch (err) {
        // A guard query that cannot run means we cannot prove the listing is
        // safe. Protect the whole chunk rather than risk a wrong delete.
        console.error("[cleanup] listing guard failed, protecting chunk:", err)
        for (const id of part) prot.add(id)
        break
      }
    }
  }
  return prot
}

/** Deletes the listings and everything that hangs off them. Returns counts. */
async function deleteListings(
  rows: ListingRow[],
  ctx: Ctx,
): Promise<{ deleted: number; files: number; protectedSkipped: number }> {
  const prot = await protectedListingIds(rows.map((r) => r.id), ctx.nowIso, ctx.nativeDB)
  const doomed = rows.filter((r) => !prot.has(r.id))
  const keys = doomed.flatMap((r) => [...extractKeys(r.images), ...extractKeys(r.verification_video)])
  if (ctx.dryRun) {
    return { deleted: doomed.length, files: new Set(keys).size, protectedSkipped: rows.length - doomed.length }
  }
  const ids = doomed.map((r) => r.id)
  // Children first, so nothing is left pointing at a deleted listing.
  for (const part of chunk(ids)) {
    const ph = placeholders(part.length)
    for (const [table, col] of [
      ["saved_listings", "listing_id"],
      ["listing_qna", "listing_id"],
      ["listing_reports", "listing_id"],
      ["reports", "listing_id"],
    ] as const) {
      try {
        await d1Query(`DELETE FROM ${table} WHERE ${col} IN (${ph})`, part, ctx.nativeDB)
      } catch {
        /* table may not exist in this database: nothing to clean */
      }
    }
  }
  const files = await deleteFiles(keys, ctx.nativeBucket)
  const deleted = await deleteByIds("listings", "id", ids, ctx.nativeDB)
  return { deleted, files, protectedSkipped: rows.length - doomed.length }
}

async function runListingJob(
  key: JobKey,
  ctx: Ctx,
  select: () => Promise<ListingRow[]>,
  requiredCols: string[],
): Promise<JobResult> {
  const r = emptyResult(key, ctx.dryRun)
  const miss = await missingSchema("listings", ["id", "images", "status", "created_at", ...requiredCols], ctx.nativeDB)
  if (miss) return { ...r, note: miss }
  const rows = await select()
  r.complete = rows.length < MAX_ROWS_PER_RUN
  const out = await deleteListings(rows, ctx)
  r.deleted = out.deleted
  r.filesDeleted = out.files
  r.protectedSkipped = out.protectedSkipped
  return r
}

// ── 9a. Dead listings: sold / paused / rejected, untouched for the window ──
export function jobListingsDead(cutoff: string, ctx: Ctx): Promise<JobResult> {
  return runListingJob(
    "listingsDead",
    ctx,
    () =>
      selectRows<ListingRow>(
        `SELECT id, images, verification_video FROM listings
          WHERE status IN ('sold', 'paused', 'rejected', 'deleted', 'inactive', 'archived')
            AND COALESCE(updated_at, created_at) < ?
          LIMIT ?`,
        [cutoff, MAX_ROWS_PER_RUN],
        ctx.nativeDB,
      ),
    ["verification_video", "updated_at"],
  )
}

// ── 9b. Listings that were never approved ─────────────────────────────
export function jobListingsPending(cutoff: string, ctx: Ctx): Promise<JobResult> {
  return runListingJob(
    "listingsPending",
    ctx,
    () =>
      selectRows<ListingRow>(
        `SELECT id, images, verification_video FROM listings
          WHERE status = 'pending' AND created_at < ?
          LIMIT ?`,
        [cutoff, MAX_ROWS_PER_RUN],
        ctx.nativeDB,
      ),
    ["verification_video"],
  )
}

// ── 9c. Listings whose seller is banned or no longer exists ───────────
export function jobListingsBannedSeller(cutoff: string, ctx: Ctx): Promise<JobResult> {
  return runListingJob(
    "listingsBannedSeller",
    ctx,
    () =>
      selectRows<ListingRow>(
        `SELECT l.id, l.images, l.verification_video FROM listings l
          LEFT JOIN users u ON u.uid = l.seller_id
          WHERE COALESCE(l.updated_at, l.created_at) < ?
            AND (u.uid IS NULL OR u.is_banned = 1)
          LIMIT ?`,
        [cutoff, MAX_ROWS_PER_RUN],
        ctx.nativeDB,
      ),
    ["verification_video", "updated_at", "seller_id"],
  )
}

// ── 9d. Idle ACTIVE listings ──────────────────────────────────────────
// "Idle" is decided from interactions the database actually records. It
// deliberately does NOT use listings.views: nothing in the app increments
// that column for listings (only blog posts have a view counter), so every
// listing reads 0 and "no views" would match every healthy listing.
//
// A listing is idle only when ALL of these hold for the whole window:
//   - it has not been updated or created inside the window,
//   - no chat, offer or saved-listing row references it inside the window,
//   - it has no order, layaway plan, active boost, open offer or FBZ stock
//     (those are the shared guards in protectedListingIds).
// Anything that fails to read is treated as "not idle", so a broken guard
// keeps the listing instead of removing it.
export function jobListingsIdle(cutoff: string, ctx: Ctx): Promise<JobResult> {
  return runListingJob(
    "listingsIdle",
    ctx,
    async () => {
      const cand = await selectRows<ListingRow>(
        `SELECT id, images, verification_video FROM listings
          WHERE status = 'active'
            AND COALESCE(is_fbz, 0) = 0
            AND created_at < ?
            AND COALESCE(updated_at, created_at) < ?
          LIMIT ?`,
        [cutoff, cutoff, MAX_ROWS_PER_RUN],
        ctx.nativeDB,
      )
      if (cand.length === 0) return cand
      const touched = new Set<string>()
      for (const part of chunk(cand.map((c) => c.id))) {
        const ph = placeholders(part.length)
        const probes: Array<[string, unknown[]]> = [
          [`SELECT DISTINCT listing_id AS id FROM chats WHERE listing_id IN (${ph}) AND COALESCE(last_message_at, updated_at, created_at) >= ?`, [...part, cutoff]],
          [`SELECT DISTINCT listing_id AS id FROM offers WHERE listing_id IN (${ph}) AND created_at >= ?`, [...part, cutoff]],
          [`SELECT DISTINCT listing_id AS id FROM saved_listings WHERE listing_id IN (${ph}) AND created_at >= ?`, [...part, cutoff]],
        ]
        for (const [sql, params] of probes) {
          try {
            for (const r of await selectRows<{ id: string }>(sql, params, ctx.nativeDB)) touched.add(String(r.id))
          } catch (err) {
            // Cannot prove the listing is untouched, so keep the whole chunk.
            console.error("[cleanup] idle probe failed, keeping chunk:", err)
            for (const id of part) touched.add(id)
            break
          }
        }
      }
      return cand.filter((c) => !touched.has(c.id))
    },
    ["verification_video", "updated_at", "is_fbz"],
  )
}
