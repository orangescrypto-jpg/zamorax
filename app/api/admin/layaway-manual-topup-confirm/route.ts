// app/api/admin/layaway-manual-topup-confirm/route.ts
// Admin-only. Confirms a manual bank transfer top-up was received (see
// app/api/orders/layaway-pay-manual/route.ts), then credits the amount to
// the plan the same way an instant Paystack/Flutterwave top-up does in
// app/api/orders/layaway-pay/route.ts, including flipping the plan to
// completed and the order to escrow_held once amount_paid reaches
// total_amount.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { paymentId, amountReceivedKobo } = await req.json()
    if (!paymentId || !amountReceivedKobo) {
      return NextResponse.json({ error: "paymentId and amountReceivedKobo required" }, { status: 400 })
    }

    const paymentRows = await d1Query("SELECT * FROM layaway_payments WHERE id = ? LIMIT 1", [paymentId], nativeDB)
    const payment = paymentRows?.results?.[0] as Record<string, unknown> | undefined
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    if (payment.status !== "pending_admin_review") {
      return NextResponse.json({ error: `Payment is already ${payment.status}` }, { status: 409 })
    }

    const planId = String(payment.plan_id)
    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.status) !== "active") {
      return NextResponse.json({ error: `Plan is ${plan.status}, cannot accept this top-up` }, { status: 409 })
    }

    const now = new Date().toISOString()
    const receivedKobo = Number(amountReceivedKobo)
    const totalAmount = Number(plan.total_amount)
    const currentPaid = Number(plan.amount_paid)
    const newPaid = currentPaid + receivedKobo
    const isComplete = newPaid >= totalAmount

    await d1Query(
      "UPDATE layaway_payments SET amount = ?, status = 'success', paid_at = ? WHERE id = ?",
      [receivedKobo, now, paymentId],
      nativeDB,
    )

    await d1Query(
      `UPDATE layaway_plans SET amount_paid = ?, status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
      [newPaid, isComplete ? "completed" : "active", isComplete ? now : null, now, planId],
      nativeDB,
    )

    if (isComplete) {
      await d1Query(
        `UPDATE orders SET status = 'escrow_held', updated_at = ? WHERE id = ?`,
        [now, String(plan.order_id)],
        nativeDB,
      )
    }

    try {
      const { sendPushNotification } = await import("@/src/services/webPush")
      if (isComplete) {
        await sendPushNotification({
          userId: String(plan.buyer_id),
          type: "layaway_reminder",
          title: "Layaway plan complete",
          body: "Your manual transfer was confirmed and you have paid off your layaway plan in full. Your order will now be processed for delivery.",
          link: `/dashboard/buyer/orders/${plan.order_id}`,
          nativeDB,
        })
        await sendPushNotification({
          userId: String(plan.seller_id),
          type: "account_activity",
          title: "Layaway plan completed",
          body: "A buyer has completed their layaway plan via manual transfer. You can now proceed with fulfillment.",
          link: `/dashboard/seller/orders/${plan.order_id}`,
          nativeDB,
        })
      } else {
        const remaining = totalAmount - newPaid
        await sendPushNotification({
          userId: String(plan.buyer_id),
          type: "layaway_reminder",
          title: "Payment confirmed",
          body: `Your manual transfer was confirmed. You have ${remaining} kobo left to complete this layaway plan.`,
          link: `/dashboard/buyer/orders/${plan.order_id}`,
          nativeDB,
        })
      }
    } catch (err) {
      console.error("layaway-manual-topup-confirm: notification failed (non-fatal):", err)
    }

    return NextResponse.json({ success: true, amountPaid: newPaid, totalAmount, completed: isComplete })
  } catch (err: any) {
    console.error("layaway-manual-topup-confirm error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
