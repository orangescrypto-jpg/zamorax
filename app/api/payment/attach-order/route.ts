// app/api/payment/attach-order/route.ts
// ─────────────────────────────────────────────────────────────────
// For manual (bank transfer) single-item orders, the order row is
// deliberately created AFTER the buyer clicks "I've Paid" (to avoid
// ghost orders from abandoned transfers). But pending_payments.metadata
// is written at payment-initialization time, before the order exists,
// so it never contains orderId.
//
// /api/payment/confirm reads payment.metadata?.orderId to know which
// order to move to escrow_held — without it, admin confirmation silently
// no-ops for the order (status stays "pending" forever even though the
// admin clicked confirm).
//
// This route patches that gap: once the buyer's order is actually
// created, the client calls this to stamp the real orderId onto the
// pending_payments metadata so confirmation can find it.
// ─────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"

export async function POST(req: NextRequest) {
  try {
    const { reference, orderId, userId } = await req.json()
    if (!reference || !orderId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
    const payment = all.find(r => String(r.reference) === reference)
    if (!payment) {
      return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })
    }

    // Only the buyer who owns this pending payment may attach an order to it.
    const paymentUserId = String(payment.userId ?? payment.user_id ?? "")
    if (paymentUserId !== String(userId)) {
      return NextResponse.json({ error: "Not authorized to modify this payment" }, { status: 403 })
    }

    const meta = (() => {
      try { return JSON.parse(String(payment.metadata ?? "{}")) } catch { return {} }
    })()
    meta.orderId = orderId

    await AdminService.updateDoc("pending_payments", String(payment.id), {
      metadata: JSON.stringify(meta),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[/api/payment/attach-order]", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
