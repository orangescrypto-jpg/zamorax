// app/api/cron/boost-expiry-sweep/route.ts
// Runs on a schedule, same trigger mechanism as layaway-sweep and
// listing-expiry-sweep (see those files for the external cron setup notes).
//
// Nothing else in the app ever turns a boost off once it's activated —
// /api/boosts/activate sets boosts.status = "active" / listings.is_boosted =
// 1 (and adBoosts.status = "active" / listings.ad_boost_status = "active"),
// and every listing sort (lib/server/listings.ts, app/api/listings/route.ts)
// orders by that raw flag with no expiry check. So a 7-day boost a seller
// paid for keeps that listing pinned to the top of search/category pages
// forever, past the window they actually paid for, and the seller's own
// dashboard (BoostCard "Active"/"Live" badge) keeps showing it as running
// indefinitely too. This sweep is what actually enforces the expiry:
//   1. Listing boosts — boosts.status = "active" AND boost_ends_at in the
//      past: flip the boost row to "expired" and clear listings.is_boosted /
//      boost_expires_at so it drops out of every boosted-first sort.
//   2. Ad boosts — adBoosts.status IN ("active","running") AND end_date in
//      the past: flip to "completed" and clear listings.ad_boost_status /
//      current_ad_boost_id.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { getCronSecret } from "@/lib/cron-secret"

interface RouteContext { params: Promise<Record<string, string>> }

async function runSweep(nativeDB?: unknown) {
  const nowIso = new Date().toISOString()
  const result = { listingBoostsExpired: 0, adBoostsExpired: 0, errors: [] as string[] }

  // ── Job 1: listing boosts ────────────────────────────────────────
  try {
    const expired = await d1Query(
      `SELECT id, listing_id FROM boosts WHERE status = 'active' AND boost_ends_at IS NOT NULL AND boost_ends_at < ?`,
      [nowIso],
      nativeDB,
    )
    const rows = ((expired as any)?.results ?? []) as { id: string; listing_id: string }[]
    for (const row of rows) {
      try {
        await d1Query(`UPDATE boosts SET status = 'expired' WHERE id = ?`, [row.id], nativeDB)
        if (row.listing_id) {
          await d1Query(
            `UPDATE listings SET is_boosted = 0, boost_expires_at = NULL WHERE id = ?`,
            [row.listing_id],
            nativeDB,
          )
        }
        result.listingBoostsExpired++
      } catch (err: any) {
        result.errors.push(`boost ${row.id}: ${err.message}`)
      }
    }
  } catch (err: any) {
    result.errors.push(`listing boosts query: ${err.message}`)
  }

  // ── Job 2: ad boosts ──────────────────────────────────────────────
  try {
    const expired = await d1Query(
      `SELECT id, product_id FROM adBoosts WHERE status IN ('active', 'running') AND end_date IS NOT NULL AND end_date < ?`,
      [nowIso],
      nativeDB,
    )
    const rows = ((expired as any)?.results ?? []) as { id: string; product_id: string | null }[]
    for (const row of rows) {
      try {
        await d1Query(`UPDATE adBoosts SET status = 'completed', updated_at = ? WHERE id = ?`, [nowIso, row.id], nativeDB)
        if (row.product_id) {
          await d1Query(
            `UPDATE listings SET ad_boost_status = NULL, current_ad_boost_id = NULL WHERE id = ? AND current_ad_boost_id = ?`,
            [row.product_id, row.id],
            nativeDB,
          )
        }
        result.adBoostsExpired++
      } catch (err: any) {
        result.errors.push(`adBoost ${row.id}: ${err.message}`)
      }
    }
  } catch (err: any) {
    result.errors.push(`ad boosts query: ${err.message}`)
  }

  return result
}

async function handle(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const cronSecret = await getCronSecret(nativeDB)
  const headerAuth = req.headers.get("authorization")
  const queryAuth = req.nextUrl.searchParams.get("secret")
  const authorised = !!cronSecret && (headerAuth === `Bearer ${cronSecret}` || queryAuth === cronSecret)
  if (!authorised) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await runSweep(nativeDB)
    return NextResponse.json({ success: true, ...result })
  } catch (err: any) {
    console.error("[cron/boost-expiry-sweep]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest, context: RouteContext) { return handle(req, context) }
export async function POST(req: NextRequest, context: RouteContext) { return handle(req, context) }
