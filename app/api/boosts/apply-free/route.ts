// app/api/boosts/apply-free/route.ts
// Applies one of a seller's monthly FREE boost credits to a listing.
// This used to run in the browser: the boost page wrote users.boost_credits_used,
// inserted an "active" boosts row and set listings.is_boosted itself, so any
// seller could boost any listing forever. The credit count, plan allowance,
// listing ownership and duration are all decided here now.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getPlatformSettings } from "@/src/services/platformSettings"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const PLAN_FREE_CREDITS: Record<string, number> = { free: 0, starter: 1, pro: 3 }
const first = (r: unknown) => (((r as any)?.results ?? [])[0] ?? null) as Record<string, unknown> | null

function monthKey() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error
  const nativeDB = (context as any)?.env?.DB

  try {
    const { listingId, planTitle } = await req.json()
    if (!listingId || !planTitle) {
      return NextResponse.json({ error: "listingId and planTitle required" }, { status: 400 })
    }

    const settings = await getPlatformSettings() as any
    const plans: Record<string, number> = {
      Standard: Number(settings.boostStandardDays),
      Premium: Number(settings.boostPremiumDays),
      "Category Top": Number(settings.boostCategoryTopDays),
    }
    const durationDays = plans[String(planTitle)]
    if (!durationDays || durationDays <= 0) {
      return NextResponse.json({ error: "Unknown boost plan" }, { status: 400 })
    }

    const listing = first(await d1Query("SELECT id, seller_id, status FROM listings WHERE id = ? LIMIT 1", [listingId], nativeDB))
    if (!listing || String(listing.seller_id) !== auth.uid) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }
    if (String(listing.status) !== "active") {
      return NextResponse.json({ error: "Only active listings can be boosted" }, { status: 409 })
    }

    const user = first(await d1Query("SELECT plan FROM users WHERE uid = ? LIMIT 1", [auth.uid], nativeDB))
    const allowance = PLAN_FREE_CREDITS[String(user?.plan ?? "free")] ?? 0
    if (allowance <= 0) {
      return NextResponse.json({ error: "Your plan has no free boost credits" }, { status: 403 })
    }

    // Atomic spend: the WHERE clause is the check, so two parallel requests
    // cannot both consume the last credit.
    const mk = monthKey()
    await d1Query(
      `UPDATE users SET
         boost_credits_used = CASE WHEN boost_credits_reset_month = ? THEN COALESCE(boost_credits_used, 0) + 1 ELSE 1 END,
         boost_credits_reset_month = ?
       WHERE uid = ?
         AND (COALESCE(boost_credits_reset_month, '') <> ? OR COALESCE(boost_credits_used, 0) < ?)`,
      [mk, mk, auth.uid, mk, allowance],
      nativeDB,
    )
    const after = first(await d1Query("SELECT boost_credits_used, boost_credits_reset_month FROM users WHERE uid = ? LIMIT 1", [auth.uid], nativeDB))
    const spentThisMonth = String(after?.boost_credits_reset_month) === mk ? Number(after?.boost_credits_used ?? 0) : 0
    if (spentThisMonth === 0 || spentThisMonth > allowance) {
      return NextResponse.json({ error: "No free boost credits left this month" }, { status: 409 })
    }

    const now = new Date().toISOString()
    const endsAt = new Date(Date.now() + durationDays * 86400000).toISOString()
    const boostId = crypto.randomUUID()
    const label = `${planTitle} · ${durationDays} day${durationDays !== 1 ? "s" : ""}`

    await d1Query(
      `INSERT INTO boosts (id, seller_id, listing_id, duration, status, payment_reference, activated_at, boost_ends_at, created_at)
       VALUES (?, ?, ?, ?, 'active', 'free_credit', ?, ?, ?)`,
      [boostId, auth.uid, listingId, label, now, endsAt, now],
      nativeDB,
    )
    await d1Query(
      "UPDATE listings SET is_boosted = 1, boost_expires_at = ?, updated_at = ? WHERE id = ? AND seller_id = ?",
      [endsAt, now, listingId, auth.uid],
      nativeDB,
    )

    return NextResponse.json({
      success: true,
      boostId,
      boostEndsAt: endsAt,
      boostCreditsUsed: spentThisMonth,
      boostCreditsResetMonth: mk,
    })
  } catch (err: any) {
    console.error("[POST /api/boosts/apply-free]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
