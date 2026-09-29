// lib/server/listing-plan-limit.ts
// Server-side enforcement of the admin-configured per-plan listing caps
// (planFreeListingLimit / planStarterListingLimit / planProListingLimit).
// Async because it needs D1 reads, so it lives outside the pure, sync
// guardNonStaffWrite() in d1-guard.ts.
import { d1Query } from "@/lib/d1"

export type ListingLimitResult =
  | { ok: true }
  | { ok: false; status: number; error: string; plan: string; limit: number; count: number }

const DEFAULT_LIMITS = { free: 5, starter: 20, pro: 0 } // pro 0 = effectively unlimited

// Statuses that occupy a slot when a NEW listing is submitted (blocks moderation-queue spam).
const SUBMIT_COUNTED = ["active", "pending", "pending_fbz", "pending_fbz_stock"]
// Statuses that occupy a slot when a listing is APPROVED.
const APPROVE_COUNTED = ["active"]

async function readLimits(nativeDB?: unknown) {
  let saved: Record<string, unknown> = {}
  try {
    const r = await d1Query("SELECT value FROM kv_store WHERE key = ? LIMIT 1", ["platform_settings"], nativeDB)
    const raw = (r as any)?.results?.[0]?.value
    if (raw) saved = JSON.parse(raw)
  } catch (err) {
    console.error("[listing-plan-limit] settings read failed, using defaults:", err)
  }
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d)
  const pro = num(saved.planProListingLimit, DEFAULT_LIMITS.pro)
  return {
    free: num(saved.planFreeListingLimit, DEFAULT_LIMITS.free),
    starter: num(saved.planStarterListingLimit, DEFAULT_LIMITS.starter),
    pro: pro > 0 ? pro : 999,
  } as Record<string, number>
}

async function check(
  sellerId: string,
  counted: string[],
  nativeDB: unknown,
  excludeListingId?: string,
): Promise<ListingLimitResult> {
  const userRes = await d1Query("SELECT plan, plan_expires_at FROM users WHERE uid = ? LIMIT 1", [sellerId], nativeDB)
  const u = (userRes as any)?.results?.[0]
  let plan = String(u?.plan || "free").toLowerCase()
  if (plan !== "free" && u?.plan_expires_at && new Date(u.plan_expires_at).getTime() < Date.now()) plan = "free"

  const limits = await readLimits(nativeDB)
  const limit = limits[plan] ?? limits.free

  const ph = counted.map(() => "?").join(",")
  const params: unknown[] = [sellerId, ...counted]
  let sql = `SELECT COUNT(*) AS c FROM listings WHERE seller_id = ? AND status IN (${ph})`
  if (excludeListingId) { sql += " AND id != ?"; params.push(excludeListingId) }
  const cRes = await d1Query(sql, params, nativeDB)
  const count = Number((cRes as any)?.results?.[0]?.c) || 0

  if (count >= limit) {
    const next = plan === "free" ? "Starter" : "Pro"
    return {
      ok: false, status: 403, plan, limit, count,
      error: plan === "pro"
        ? `Listing limit reached (${count}/${limit}).`
        : `Listing limit reached (${count}/${limit} on the ${plan} plan). Upgrade to ${next} to post more.`,
    }
  }
  return { ok: true }
}

/** Call before a seller creates a new listing. */
export function checkListingSubmitLimit(sellerId: string, nativeDB?: unknown) {
  return check(sellerId, SUBMIT_COUNTED, nativeDB)
}

/** Call before a listing is flipped to 'active' (approval). */
export function checkListingApproveLimit(sellerId: string, listingId: string, nativeDB?: unknown) {
  return check(sellerId, APPROVE_COUNTED, nativeDB, listingId)
}
