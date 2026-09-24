// lib/cleanup/settings.ts
// Admin-editable retention windows for the Storage & Cleanup page and the
// weekly cron. Stored as one JSON blob in kv_store (key "config:cleanup"),
// the same table the fees/settings routes already use, so no new table is
// needed just for settings.
//
// A value of 0 means "never delete" for that job. Any other value is clamped
// to the job's floor so a typo (say 1 instead of 12) cannot wipe records
// that are still needed.
import { d1Query } from "@/lib/d1"

export type JobKey =
  | "notificationsRead"
  | "notificationsUnread"
  | "messages"
  | "chats"
  | "offers"
  | "proofs"
  | "ordersArchive"
  | "transactionsArchive"
  | "listingsDead"
  | "listingsPending"
  | "listingsBannedSeller"
  | "listingsIdle"
  | "pendingPayments"
  | "reports"
  | "boostsAndBanners"
  | "rateLimits"
  | "mediaLibrary"
  | "orphanFiles"
  | "deletedUserLeftovers"

export interface JobMeta {
  key: JobKey
  label: string
  description: string
  unit: "days" | "months"
  defaultValue: number
  /** Smallest non-zero value allowed. */
  floor: number
  /** Touches money records, so it archives first and needs extra care. */
  financial?: boolean
  /** Marks jobs that are off unless the admin turns them on. */
  offByDefault?: boolean
}

export const JOBS: JobMeta[] = [
  { key: "notificationsRead", label: "Notifications (read)", description: "In-app notifications the user has already read.", unit: "days", defaultValue: 30, floor: 3 },
  { key: "notificationsUnread", label: "Notifications (unread)", description: "Notifications never opened. Older than this they are stale.", unit: "days", defaultValue: 90, floor: 14 },
  { key: "messages", label: "Chat messages", description: "Skips any chat tied to an open dispute or unfinished order.", unit: "months", defaultValue: 12, floor: 3 },
  { key: "chats", label: "Empty / old chats", description: "Chat threads with no messages left, or older than this.", unit: "months", defaultValue: 12, floor: 3 },
  { key: "offers", label: "Offers", description: "Expired, rejected and old accepted offers.", unit: "days", defaultValue: 30, floor: 7 },
  { key: "proofs", label: "Payment proofs and evidence", description: "Proof screenshots and dispute files, after the order is completed.", unit: "days", defaultValue: 90, floor: 30 },
  { key: "ordersArchive", label: "Orders (archive then delete)", description: "Finished orders are saved to a file in R2 first, then removed.", unit: "months", defaultValue: 12, floor: 6, financial: true },
  { key: "transactionsArchive", label: "Transactions (archive then delete)", description: "Wallet history is saved to a file in R2 first, then removed.", unit: "months", defaultValue: 12, floor: 6, financial: true },
  { key: "listingsDead", label: "Dead listings (sold / paused / rejected)", description: "Listings with no orders. Their images are deleted too.", unit: "days", defaultValue: 90, floor: 30 },
  { key: "listingsPending", label: "Listings never approved", description: "Pending listings that were never reviewed.", unit: "days", defaultValue: 60, floor: 14 },
  { key: "listingsBannedSeller", label: "Listings of banned sellers", description: "Listings whose seller is banned or gone.", unit: "days", defaultValue: 30, floor: 7 },
  { key: "listingsIdle", label: "Idle active listings", description: "Live listings with no update, chat, offer, order or save for this long. Listings in stock at Zamorax, or with an order, boost or open offer, are never removed.", unit: "days", defaultValue: 365, floor: 180 },
  { key: "pendingPayments", label: "Abandoned payment attempts", description: "Pending, rejected and unpaid payment attempts.", unit: "days", defaultValue: 30, floor: 7 },
  { key: "reports", label: "Resolved reports", description: "Closed user and listing reports.", unit: "days", defaultValue: 90, floor: 14 },
  { key: "boostsAndBanners", label: "Ended boosts and banners", description: "Expired boosts and inactive banners, with banner images.", unit: "days", defaultValue: 30, floor: 7 },
  { key: "rateLimits", label: "Rate-limit rows", description: "Counters older than their window. Safe to clear daily.", unit: "days", defaultValue: 1, floor: 1 },
  { key: "mediaLibrary", label: "Unused uploaded images", description: "Image library entries no longer used anywhere.", unit: "days", defaultValue: 30, floor: 7 },
  { key: "orphanFiles", label: "Orphan files in R2", description: "Files no database row points to. Always preview first.", unit: "days", defaultValue: 7, floor: 2 },
  { key: "deletedUserLeftovers", label: "Leftovers of deleted users", description: "Rows still pointing at users who no longer exist.", unit: "days", defaultValue: 30, floor: 7 },
]

export type CleanupSettings = Record<JobKey, number>

export const JOB_BY_KEY: Record<JobKey, JobMeta> = Object.fromEntries(
  JOBS.map((j) => [j.key, j]),
) as Record<JobKey, JobMeta>

export const DEFAULT_SETTINGS: CleanupSettings = Object.fromEntries(
  JOBS.map((j) => [j.key, j.defaultValue]),
) as CleanupSettings

const KV_KEY = "config:cleanup"
const MAX_VALUE = 3650

/** Coerces any input to a valid stored value: 0 = never, else clamped to [floor, MAX]. */
export function clampSetting(job: JobKey, value: unknown): number {
  const meta = JOB_BY_KEY[job]
  const n = Number(value)
  if (!Number.isFinite(n)) return meta.defaultValue
  const r = Math.round(n)
  if (r <= 0) return 0
  return Math.min(MAX_VALUE, Math.max(meta.floor, r))
}

/** Converts a job's stored value to a number of days for cutoff maths. */
export function toDays(job: JobKey, value: number): number {
  return JOB_BY_KEY[job].unit === "months" ? value * 30 : value
}

async function ensureKv(nativeDB?: unknown) {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
    [],
    nativeDB,
  )
}

export async function getCleanupSettings(nativeDB?: unknown): Promise<CleanupSettings> {
  try {
    await ensureKv(nativeDB)
    const rows = await d1Query("SELECT value FROM kv_store WHERE key = ? LIMIT 1", [KV_KEY], nativeDB)
    const raw = (rows?.results?.[0] as { value?: string } | undefined)?.value
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Record<JobKey, unknown>>
    const out = { ...DEFAULT_SETTINGS }
    for (const j of JOBS) {
      if (parsed[j.key] !== undefined) out[j.key] = clampSetting(j.key, parsed[j.key])
    }
    return out
  } catch (err) {
    console.error("[cleanup] settings read failed, using defaults:", err)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveCleanupSettings(
  input: Partial<Record<JobKey, unknown>>,
  nativeDB?: unknown,
): Promise<CleanupSettings> {
  const current = await getCleanupSettings(nativeDB)
  const next = { ...current }
  for (const j of JOBS) {
    if (input[j.key] !== undefined) next[j.key] = clampSetting(j.key, input[j.key])
  }
  await ensureKv(nativeDB)
  const now = new Date().toISOString()
  await d1Query(
    `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [KV_KEY, JSON.stringify(next), now],
    nativeDB,
  )
  return next
}
