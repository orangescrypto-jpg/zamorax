// app/api/cron/layaway-sweep/route.ts
// Runs on a schedule (see notes at the bottom on how this is triggered).
// Five jobs, each independent so one failing does not block the others:
//   1. Expire plans past expires_at that never reached 100% paid. These
//      move to status "expired" and refund_status "awaiting_bank_details"
//      -- the buyer still needs to supply the account to refund into, the
//      same as a voluntary cancellation, so no money moves here yet.
//   2. Remind buyers whose plan is due within 3 days.
//   3. Auto-confirm a refund if the buyer has not confirmed receipt
//      within 24 hours of admin/moderator marking it paid.
//   4. Permanently delete a plan, its payment history, and its order 12
//      hours after its refund was confirmed, whether the buyer confirmed
//      it or the system auto-confirmed it. The sale never completed, so
//      nothing about it needs to remain visible to buyer, seller, admin,
//      or moderator once the refund is settled.
//   5. Clean up manual bank transfer deposits that an admin never
//      confirmed within 3 days. No confirmed money ever moved for these
//      (the deposit sat in "pending_admin_confirmation" the whole time),
//      so this is a straightforward deletion, not a refund -- there is
//      nothing to pay back.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { sendPushNotification } from "@/src/services/webPush"
import { getCronSecret } from "@/lib/cron-secret"
import { getSubSettings } from "@/src/services/subSettings"
import { computeExitFeeKobo } from "@/app/api/orders/layaway-cancel/route"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function runSweep(nativeDB: unknown) {
  const now = new Date()
  const nowIso = now.toISOString()
  const result = { expired: 0, reminded: 0, autoConfirmed: 0, purged: 0, staleManualDepositsRemoved: 0 }

  const expiredRows = await d1Query(
    "SELECT * FROM layaway_plans WHERE status = 'active' AND expires_at < ?",
    [nowIso],
    nativeDB,
  )
  const subSettings = await getSubSettings()
  for (const plan of (expiredRows?.results ?? []) as Record<string, unknown>[]) {
    const planId = String(plan.id)
    const listingId = String(plan.listing_id)
    const orderId = String(plan.order_id)
    const amountPaid = Number(plan.amount_paid)
    const exitFee = computeExitFeeKobo(amountPaid, subSettings)
    const netRefund = amountPaid - exitFee
    try {
      await d1Query(
        `UPDATE layaway_plans SET
          status = 'expired', defaulted_at = ?, refund_status = 'awaiting_bank_details',
          exit_fee_kobo = ?, refund_amount_kobo = ?, updated_at = ?
        WHERE id = ?`,
        [nowIso, exitFee, netRefund, nowIso, planId],
        nativeDB,
      )
      await d1Query("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowIso, orderId], nativeDB)
      let restockQty = 1
      try {
        const orderRows = await d1Query("SELECT line_items FROM orders WHERE id = ? LIMIT 1", [orderId], nativeDB)
        const lineItems = JSON.parse((orderRows?.results?.[0] as any)?.line_items ?? "[]")
        if (Array.isArray(lineItems) && lineItems[0]?.qty > 0) restockQty = Number(lineItems[0].qty)
      } catch { /* fall back to 1 */ }
      await d1Query("UPDATE listings SET stock_qty = COALESCE(stock_qty, 0) + ? WHERE id = ?", [restockQty, listingId], nativeDB)

      await sendPushNotification({
        userId: String(plan.buyer_id),
        type: "layaway_reminder",
        title: "Layaway plan expired",
        body: "Your layaway plan passed its deadline without full payment. Please provide your bank details in the app so we can process your refund, minus the exit fee shown at checkout.",
        link: `/dashboard/buyer/orders/${orderId}`,
        nativeDB,
      })
      await sendPushNotification({
        userId: String(plan.seller_id),
        type: "account_activity",
        title: "Layaway plan expired",
        body: "A buyer's layaway plan expired before completion. The item is back in your active stock.",
        link: `/dashboard/seller/listings/${listingId}`,
        nativeDB,
      })
      result.expired++
    } catch (err) {
      console.error("[layaway-sweep] failed to expire plan", planId, err)
    }
  }

  const soonThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const dueSoonRows = await d1Query(
    "SELECT * FROM layaway_plans WHERE status = 'active' AND expires_at <= ? AND expires_at > ?",
    [soonThreshold, nowIso],
    nativeDB,
  )
  for (const plan of (dueSoonRows?.results ?? []) as Record<string, unknown>[]) {
    try {
      const remaining = Number(plan.total_amount) - Number(plan.amount_paid)
      if (remaining <= 0) continue
      await sendPushNotification({
        userId: String(plan.buyer_id),
        type: "layaway_reminder",
        title: "Layaway payment due soon",
        body: `You have ${remaining} kobo left to pay before your layaway deadline.`,
        link: `/dashboard/buyer/orders/${plan.order_id}`,
        nativeDB,
      })
      result.reminded++
    } catch (err) {
      console.error("[layaway-sweep] reminder failed for plan", plan.id, err)
    }
  }

  const autoConfirmRows = await d1Query(
    "SELECT * FROM layaway_plans WHERE refund_status = 'paid' AND refund_confirm_deadline < ?",
    [nowIso],
    nativeDB,
  )
  for (const plan of (autoConfirmRows?.results ?? []) as Record<string, unknown>[]) {
    const planId = String(plan.id)
    try {
      const purgeAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()
      await d1Query(
        `UPDATE layaway_plans SET
          refund_status = 'auto_confirmed', refund_confirmed_at = ?, refund_confirmed_by = 'system',
          purge_at = ?, updated_at = ?
        WHERE id = ?`,
        [nowIso, purgeAt, nowIso, planId],
        nativeDB,
      )
      await sendPushNotification({
        userId: String(plan.buyer_id),
        type: "layaway_reminder",
        title: "Refund confirmed",
        body: "Your layaway refund was automatically marked as confirmed after 24 hours.",
        link: `/dashboard/buyer/orders/${plan.order_id}`,
        nativeDB,
      })
      await sendPushNotification({
        userId: String(plan.seller_id),
        type: "account_activity",
        title: "Refund confirmed",
        body: "The refund on a cancelled layaway plan has been confirmed.",
        link: `/dashboard/seller/listings/${plan.listing_id}`,
        nativeDB,
      })
      result.autoConfirmed++
    } catch (err) {
      console.error("[layaway-sweep] auto-confirm failed for plan", planId, err)
    }
  }

  const purgeRows = await d1Query(
    "SELECT id, order_id FROM layaway_plans WHERE purge_at IS NOT NULL AND purge_at < ?",
    [nowIso],
    nativeDB,
  )
  for (const row of (purgeRows?.results ?? []) as Record<string, unknown>[]) {
    const planId = String(row.id)
    const orderId = row.order_id ? String(row.order_id) : null
    try {
      // The sale never completed, so nothing about this attempt needs to
      // remain visible to buyer, seller, admin, or moderator once the
      // refund is settled. Delete the plan, its payment history, and the
      // order itself, in that order to respect any foreign key ordering.
      await d1Query("DELETE FROM layaway_payments WHERE plan_id = ?", [planId], nativeDB)
      await d1Query("DELETE FROM layaway_plans WHERE id = ?", [planId], nativeDB)
      if (orderId) {
        await d1Query("DELETE FROM orders WHERE id = ?", [orderId], nativeDB)
      }
      result.purged++
    } catch (err) {
      console.error("[layaway-sweep] purge failed for plan", planId, err)
    }
  }

  const staleManualRows = await d1Query(
    "SELECT id, order_id, buyer_id FROM layaway_plans WHERE status = 'pending_admin_confirmation' AND created_at < ?",
    [new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()],
    nativeDB,
  )
  for (const plan of (staleManualRows?.results ?? []) as Record<string, unknown>[]) {
    const planId = String(plan.id)
    const orderId = plan.order_id ? String(plan.order_id) : null
    try {
      await d1Query("DELETE FROM layaway_payments WHERE plan_id = ?", [planId], nativeDB)
      await d1Query("DELETE FROM layaway_plans WHERE id = ?", [planId], nativeDB)
      if (orderId) {
        await d1Query("DELETE FROM orders WHERE id = ?", [orderId], nativeDB)
      }
      await sendPushNotification({
        userId: String(plan.buyer_id),
        type: "layaway_reminder",
        title: "Layaway deposit request cancelled",
        body: "Your bank transfer deposit was not confirmed in time and this layaway request has been removed. You can start a new one anytime.",
        nativeDB,
      })
      result.staleManualDepositsRemoved++
    } catch (err) {
      console.error("[layaway-sweep] failed to remove stale manual deposit", planId, err)
    }
  }

  return result
}

// GET supports cron-job.org's simplest setup: a plain URL with the
// secret in the query string (?secret=...), since cron-job.org's free
// tier does not let you attach a custom Authorization header. A header
// is still accepted too, for schedulers that can set one.
export async function GET(req: NextRequest, context: RouteContext) {
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
    console.error("[cron/layaway-sweep]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Some job schedulers (Cloudflare Cron Triggers, a server side job queue,
// a hosting platform's own cron feature) call the same endpoint with POST
// instead of GET, or cannot set a custom Authorization header and instead
// pass the secret as a query param. Both are accepted here so this sweep
// is not tied to GitHub Actions being the only thing able to trigger it.
export async function POST(req: NextRequest, context: RouteContext) {
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
    console.error("[cron/layaway-sweep]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
