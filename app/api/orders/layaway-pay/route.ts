// app/api/orders/layaway-pay/route.ts
// Buyer-initiated top-up on an existing layaway plan. Verifies the
// payment with Paystack/Flutterwave, then credits it to amount_paid.
// When amount_paid reaches total_amount, the plan flips to completed and
// the underlying order moves to escrow_held so the normal
// shipping/delivery/escrow-release flow can take over from there.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function verifyPaystack(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()
  if (!data.status || data.data?.status !== "success") return null
  return { amount: data.data.amount as number }
}

async function verifyFlutterwave(reference: string) {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  )
  const data = await res.json()
  if (data.status !== "success" || data.data?.status !== "successful") return null
  return { amount: (data.data.amount as number) * 100 }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { planId, reference, provider } = await req.json()
    if (!planId || !reference || !provider) {
      return NextResponse.json({ error: "planId, reference, provider required" }, { status: 400 })
    }
    if (provider !== "paystack" && provider !== "flutterwave") {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 })
    }

    const existingPayment = await d1Query(
      "SELECT id FROM layaway_payments WHERE provider_ref = ? LIMIT 1",
      [reference],
      nativeDB,
    )
    if (existingPayment?.results?.[0]) {
      return NextResponse.json({ success: true, alreadyRecorded: true })
    }

    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

    if (String(plan.buyer_id) !== auth.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }
    if (String(plan.status) !== "active") {
      return NextResponse.json({ error: `This plan is ${plan.status}, no further payments accepted` }, { status: 409 })
    }

    const verified = provider === "paystack"
      ? await verifyPaystack(reference)
      : await verifyFlutterwave(reference)
    if (!verified) {
      return NextResponse.json({ error: "Payment not verified" }, { status: 402 })
    }

    const now = new Date().toISOString()
    const totalAmount = Number(plan.total_amount)
    const currentPaid = Number(plan.amount_paid)
    const newPaid = currentPaid + verified.amount
    const isComplete = newPaid >= totalAmount

    await d1Query(
      `INSERT INTO layaway_payments (id, plan_id, amount, provider, provider_ref, status, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', ?, ?)`,
      [crypto.randomUUID(), planId, verified.amount, provider, reference, now, now],
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
          body: "You have paid off your layaway plan in full. Your order will now be processed for delivery.",
          link: `/dashboard/buyer/orders/${plan.order_id}`,
          nativeDB,
        })
        await sendPushNotification({
          userId: String(plan.seller_id),
          type: "account_activity",
          title: "Layaway plan completed",
          body: "A buyer has completed their layaway plan. You can now proceed with fulfillment.",
          link: `/dashboard/seller/orders/${plan.order_id}`,
          nativeDB,
        })
      } else {
        const remaining = totalAmount - newPaid
        await sendPushNotification({
          userId: String(plan.buyer_id),
          type: "layaway_reminder",
          title: "Payment received",
          body: `Thanks. You have ${remaining} kobo left to complete this layaway plan.`,
          link: `/dashboard/buyer/orders/${plan.order_id}`,
          nativeDB,
        })
      }
    } catch (err) {
      console.error("layaway-pay: notification failed (non-fatal):", err)
    }

    return NextResponse.json({ success: true, amountPaid: newPaid, totalAmount, completed: isComplete })
  } catch (err: any) {
    console.error("layaway-pay error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
