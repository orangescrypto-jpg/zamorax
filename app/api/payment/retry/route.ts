// app/api/payment/retry/route.ts
// Buyer resubmits payment on an order whose payment was rejected by admin
// (order.status === "payment_rejected"). Creates a FRESH pending_payments
// row with a new reference bound to the same order — this intentionally
// does NOT let the buyer resubmit their old (rejected) proof; a new
// screenshot must be uploaded via /api/payment/notify-admin the same way
// as the original checkout, using the new reference this route returns.
//
// Capped at 3 retries per order (payment_retry_count) to stop an order
// sitting in limbo forever — after that, the buyer is told to contact
// support or cancel and re-checkout as a new order.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { ManualPaymentService } from "@/src/services/providers/manual/payment"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const MAX_RETRIES = 3

function generateReference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `${prefix}_${Date.now()}${rand}`
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireAuth(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })

    const rows = await d1Query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId], nativeDB)
    const order = (rows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const buyerId = String(order.buyer_id ?? "")
    if (buyerId !== auth.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }

    const status = String(order.status ?? "")
    if (status !== "payment_rejected") {
      return NextResponse.json(
        { error: `This order isn't awaiting a payment retry (status: "${status}").` },
        { status: 409 },
      )
    }

    const retryCount = Number(order.payment_retry_count ?? 0)
    if (retryCount >= MAX_RETRIES) {
      return NextResponse.json(
        {
          error: `This order has reached the maximum of ${MAX_RETRIES} payment attempts. Please contact support or cancel this order and check out again.`,
          maxRetriesReached: true,
        },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()
    const reference = generateReference("ZMX-ORD")
    const bankDetails = await ManualPaymentService.getBankDetails()
    const amount = Number(order.total_amount ?? 0)

    await d1Query(
      `INSERT INTO pending_payments (id, user_id, reference, purpose, amount, metadata, provider, status, admin_confirmed, created_at)
       VALUES (?, ?, ?, 'order', ?, ?, 'manual', 'awaiting_transfer', 0, ?)`,
      [
        crypto.randomUUID(),
        buyerId,
        reference,
        amount,
        JSON.stringify({ orderId, itemTitle: order.item_title ?? "", isRetry: true }),
        now,
      ],
      nativeDB,
    )

    // Move the order back to "pending" (awaiting new proof) and record the
    // retry — payment_retry_count is what MAX_RETRIES checks above, and
    // clearing the previous rejection fields means the order detail page
    // shows the fresh bank-transfer step, not the old rejection banner.
    await d1Query(
      `UPDATE orders
       SET status = 'pending', payment_reference = ?, payment_retry_count = ?,
           rejection_reason = NULL, rejected_at = NULL, rejected_by = NULL,
           updated_at = ?
       WHERE id = ?`,
      [reference, retryCount + 1, now, orderId],
      nativeDB,
    )

    return NextResponse.json({
      success:       true,
      reference,
      bankDetails:   bankDetails ?? null,
      amount,
      retriesLeft:   MAX_RETRIES - (retryCount + 1),
    })
  } catch (err: any) {
    console.error("[POST /api/payment/retry]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
