// lib/cleanup/runner.ts
// Runs one job or all of them. This is the single entry point used by the
// weekly cron, the admin "Run now" buttons and the "Run all" button, so
// every path applies exactly the same rules.
import {
  cutoffFor,
  emptyResult,
  resetSchemaCache,
  type JobResult,
} from "@/lib/cleanup/helpers"
import {
  jobBoostsAndBanners,
  jobChats,
  jobMessages,
  jobNotificationsRead,
  jobNotificationsUnread,
  jobOffers,
  jobPendingPayments,
  jobRateLimits,
  jobReports,
  type Ctx,
} from "@/lib/cleanup/jobs-basic"
import { jobOrdersArchive, jobProofs, jobTransactionsArchive } from "@/lib/cleanup/jobs-financial"
import {
  jobDeletedUserLeftovers,
  jobMediaLibrary,
  jobOrphanFiles,
  type OrphanReport,
} from "@/lib/cleanup/jobs-files"
import {
  jobListingsBannedSeller,
  jobListingsDead,
  jobListingsIdle,
  jobListingsPending,
} from "@/lib/cleanup/jobs-listings"
import { JOBS, getCleanupSettings, type CleanupSettings, type JobKey } from "@/lib/cleanup/settings"

type JobFn = (cutoff: string, ctx: Ctx) => Promise<JobResult | OrphanReport>

const REGISTRY: Record<JobKey, JobFn> = {
  notificationsRead: jobNotificationsRead,
  notificationsUnread: jobNotificationsUnread,
  messages: jobMessages,
  chats: jobChats,
  offers: jobOffers,
  proofs: jobProofs,
  ordersArchive: jobOrdersArchive,
  transactionsArchive: jobTransactionsArchive,
  listingsDead: jobListingsDead,
  listingsPending: jobListingsPending,
  listingsBannedSeller: jobListingsBannedSeller,
  listingsIdle: jobListingsIdle,
  pendingPayments: jobPendingPayments,
  reports: jobReports,
  boostsAndBanners: jobBoostsAndBanners,
  rateLimits: jobRateLimits,
  mediaLibrary: jobMediaLibrary,
  orphanFiles: (minAge, ctx) => jobOrphanFiles(Number(minAge), ctx),
  deletedUserLeftovers: jobDeletedUserLeftovers,
}

/**
 * The order matters. Dependants go before the things they point at:
 * messages before chats, orders before their transactions, listings after
 * orders (so a listing's order is already archived), and the file sweeps
 * last, once every row that referenced a file has been removed.
 */
export const RUN_ORDER: JobKey[] = [
  "rateLimits",
  "notificationsRead",
  "notificationsUnread",
  "offers",
  "messages",
  "chats",
  "pendingPayments",
  "proofs",
  "reports",
  "boostsAndBanners",
  "ordersArchive",
  "transactionsArchive",
  "listingsDead",
  "listingsPending",
  "listingsBannedSeller",
  "listingsIdle",
  "deletedUserLeftovers",
  "mediaLibrary",
  "orphanFiles",
]

export interface RunOptions {
  nativeDB?: unknown
  nativeBucket?: unknown
  dryRun?: boolean
  /** Overrides the saved settings (used by tests and previews). */
  settings?: CleanupSettings
}

export async function runJob(key: JobKey, opts: RunOptions = {}): Promise<JobResult | OrphanReport> {
  const dryRun = !!opts.dryRun
  const settings = opts.settings ?? (await getCleanupSettings(opts.nativeDB))
  const value = settings[key]
  if (!value || value <= 0) {
    return { ...emptyResult(key, dryRun), disabled: true, note: "Turned off (set to 0 days). Nothing was changed." }
  }
  const nowMs = Date.now()
  const ctx: Ctx = {
    nativeDB: opts.nativeDB,
    nativeBucket: opts.nativeBucket,
    dryRun,
    nowIso: new Date(nowMs).toISOString(),
  }
  try {
    // The orphan job receives its minimum file age in days, not a cutoff.
    // orphanFiles is configured in days (see settings.ts), so its value is used as-is.
    const arg = key === "orphanFiles" ? String(value) : cutoffFor(key, value, nowMs)
    return await REGISTRY[key](arg, ctx)
  } catch (err) {
    console.error(`[cleanup] job ${key} failed:`, err)
    return { ...emptyResult(key, dryRun), note: `Failed: ${(err as Error).message}`, complete: false }
  }
}

export interface RunAllResult {
  ranAt: string
  dryRun: boolean
  results: Array<JobResult | OrphanReport>
  totalDeleted: number
  totalFiles: number
  allComplete: boolean
}

/** Runs every enabled job in a safe order. One failing job never stops the rest. */
export async function runAll(opts: RunOptions = {}): Promise<RunAllResult> {
  resetSchemaCache()
  const settings = opts.settings ?? (await getCleanupSettings(opts.nativeDB))
  const results: Array<JobResult | OrphanReport> = []
  for (const key of RUN_ORDER) {
    results.push(await runJob(key, { ...opts, settings }))
  }
  return {
    ranAt: new Date().toISOString(),
    dryRun: !!opts.dryRun,
    results,
    totalDeleted: results.reduce((s, r) => s + r.deleted, 0),
    totalFiles: results.reduce((s, r) => s + r.filesDeleted, 0),
    allComplete: results.every((r) => r.complete),
  }
}

// Sanity check at import time in development: every job must be registered and ordered.
if (process.env.NODE_ENV !== "production") {
  const missing = JOBS.filter((j) => !REGISTRY[j.key] || !RUN_ORDER.includes(j.key)).map((j) => j.key)
  if (missing.length) console.warn("[cleanup] jobs missing from REGISTRY/RUN_ORDER:", missing)
}
