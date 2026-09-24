// app/api/orders/layaway-cancel/route.ts
// Buyer-initiated cancellation of an active layaway plan. Two-step:
//   1. GET returns a quote (amount paid, exit fee, net refund) so the
//      client can show the confirmation dialog before anything changes.
//   2. POST performs the cancellation, records the exit fee, and stores
//      the bank details the buyer provides for the refund. Moves the plan
//      to refund_status = "pending_review" so admin/moderator can see it
//      and pay it out manually.
// Per the layaway agreement shown at checkout, the same exit fee applies
// whether the buyer cancels voluntarily or the plan expires unpaid (see
// cron/layaway-sweep, which calls the same cancellation math on expiry).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getSubSettings } from "@/src/services/subSettings"
import { restoreStock } from "@/lib/stockManagement"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export function computeExitFeeKobo(amountPaidKobo: number, settings: { layawayExitFeeType: "percent" | "flat"; layawayExitFeePercent: number; layawayExitFeeFlatKobo: number }) {
  if (settings.layawayExitFeeType === "flat") {
    return Math.min(settings.layawayExitFeeFlatKobo, amountPaidKobo)
  }
  return Math.min(Math.ceil((amountPaidKobo * settings.layawayExitFeePercent) / 100), amountPaidKobo)
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB
  const planId = req.nextUrl.searchParams.get("planId")
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 })

  try {
    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.buyer_id) !== auth.uid) return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    if (String(plan.status) !== "active") {
      return NextResponse.json({ error: `This plan is ${plan.status} and cannot be cancelled` }, { status: 409 })
    }

    const settings = await getSubSettings()
    const amountPaid = Number(plan.amount_paid)
    const exitFee = computeExitFeeKobo(amountPaid, settings)
    const netRefund = amountPaid - exitFee

    return NextResponse.json({
      amountPaid,
      exitFeeKobo: exitFee,
      exitFeeType: settings.layawayExitFeeType,
      exitFeePercent: settings.layawayExitFeePercent,
      netRefundKobo: netRefund,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { planId, bankName, accountNumber, accountName, originalFundingNote } = await req.json()
    if (!planId || !bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: "planId, bankName, accountNumber, and accountName are required" },
        { status: 400 },
      )
    }

    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.buyer_id) !== auth.uid) return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    if (String(plan.status) !== "active") {
      return NextResponse.json({ error: `This plan is ${plan.status} and cannot be cancelled` }, { status: 409 })
    }

    const settings = await getSubSettings()
    const amountPaid = Number(plan.amount_paid)
    const exitFee = computeExitFeeKobo(amountPaid, settings)
    const netRefund = amountPaid - exitFee
    const now = new Date().toISOString()

    await d1Query(
      `UPDATE layaway_plans SET
        status = 'cancelled', cancelled_at = ?,
        exit_fee_kobo = ?, refund_amount_kobo = ?, refund_status = 'pending_review',
        refund_requested_at = ?, refund_bank_name = ?, refund_account_number = ?,
        refund_account_name = ?, refund_original_funding_note = ?, updated_at = ?
      WHERE id = ?`,
      [now, exitFee, netRefund, now, bankName, accountNumber, accountName, originalFundingNote || null, now, planId],
      nativeDB,
    )

    await d1Query(
      `UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?`,
      [now, String(plan.order_id)],
      nativeDB,
    )

    // Item never left the seller's hands, so it goes straight back into
    // active stock, in the same quantity that was reserved for this plan.
    try {
      const orderRows = await d1Query("SELECT line_items FROM orders WHERE id = ? LIMIT 1", [String(plan.order_id)], nativeDB)
      let restockQty = 1
      try {
        const lineItems = JSON.parse((orderRows?.results?.[0] as any)?.line_items ?? "[]")
        if (Array.isArray(lineItems) && lineItems[0]?.qty > 0) restockQty = Number(lineItems[0].qty)
      } catch { /* fall back to 1 */ }
      await restoreStock(String(plan.listing_id), restockQty, nativeDB)
    } catch { /* non-fatal */ }

    try {
      const { sendPushNotification } = await import("@/src/services/webPush")
      await sendPushNotification({
        userId: String(plan.buyer_id),
        type: "layaway_reminder",
        title: "Layaway plan cancelled",
        body: `Your plan was cancelled. A refund of ${netRefund} kobo is being reviewed and will be paid to the bank details you provided.`,
        link: `/dashboard/buyer/orders/${plan.order_id}`,
        nativeDB,
      })
      await sendPushNotification({
        userId: String(plan.seller_id),
        type: "account_activity",
        title: "Layaway plan cancelled",
        body: "A buyer cancelled their layaway plan. The item is back in your active stock.",
        link: `/dashboard/seller/listings/${plan.listing_id}`,
        nativeDB,
      })
    } catch (err) {
      console.error("layaway-cancel: notification failed (non-fatal):", err)
    }

    return NextResponse.json({ success: true, exitFeeKobo: exitFee, netRefundKobo: netRefund })
  } catch (err: any) {
    console.error("layaway-cancel error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
