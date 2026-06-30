// app/api/cart/create-pending-orders/route.ts
// Creates the per-seller order rows for a cart checkout that is paying via an
// ONLINE gateway (Paystack/Flutterwave). Mirrors what BuyNowModal does for
// single-item purchases: the order is created with status "pending" right
// before the redirect, so it actually exists once the buyer comes back —
// instead of only living in `pending_payments` (which, for carts, was only
// ever turned into orders by an admin manually confirming a bank transfer).
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"

export async function POST(req: NextRequest) {
  try {
    const { reference } = await req.json()
    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 })
    }

    const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
    const payment = all.find(r => String(r.reference) === reference)
    if (!payment) return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })

    // Idempotent: if orders were already created for this reference, return them.
    const existing = await AdminService.getCollection("orders") as Record<string, unknown>[]
    const already = existing.filter(o => o.cart_payment_ref === reference || o.payment_reference === reference)
    if (already.length > 0) {
      return NextResponse.json({ success: true, orderIds: already.map(o => o.id) })
    }

    const meta = (() => { try { return JSON.parse(String(payment.metadata ?? "{}")) } catch { return {} } })()
    const cartItems: any[] = Array.isArray(meta.cartItems) ? meta.cartItems : []
    if (!cartItems.length) return NextResponse.json({ error: "No cart items on payment" }, { status: 400 })

    const provider = String(payment.provider ?? "")
    const createdOrderIds: string[] = []

    for (const group of cartItems) {
      const { sellerId, sellerName, sellerState, lineItems, deliveryMethod, deliveryFee, subtotal, platformFee, sellerPayout } = group
      const orderId   = crypto.randomUUID()
      const itemTitle = `${sellerName} — ${lineItems?.length ?? 1} item${lineItems?.length === 1 ? "" : "s"}`

      await AdminService.setDoc("orders", orderId, {
        id: orderId, buyer_id: payment.user_id, buyer_name: meta.buyerName ?? "",
        seller_id: sellerId, seller_name: sellerName, seller_state: sellerState,
        listing_id: lineItems?.[0]?.listingId ?? "", item_title: itemTitle,
        line_items: JSON.stringify(lineItems ?? []),
        total_amount: subtotal, platform_fee: platformFee, seller_payout: sellerPayout,
        delivery_method: deliveryMethod, delivery_fee: deliveryFee ?? 0,
        delivery_street: meta.deliveryStreet ?? "", delivery_city: meta.deliveryCity ?? "",
        delivery_state: meta.deliveryState ?? "", delivery_lga: meta.deliveryLga ?? "",
        // Payment isn't verified yet — keep this pending. /api/payment/verify
        // (called once the buyer lands back on the orders page) is what should
        // flip this to escrow_held, the same way it does for single-item orders.
        status: "pending", escrow_status: "pending",
        order_type: "purchase", payment_reference: reference, payment_provider: provider,
        cart_payment_ref: reference,
      })
      createdOrderIds.push(orderId)
    }

    return NextResponse.json({ success: true, orderIds: createdOrderIds })
  } catch (err: any) {
    console.error("create-pending-orders error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
