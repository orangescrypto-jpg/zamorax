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

    // FIX: getCollection returns rowToDoc output (snake_case → camelCase),
    // so reads must use camelCase. Resolve with a snake_case fallback in
    // case a provider ever returns raw rows.
    const buyerId = String(payment.userId ?? payment.user_id ?? "")
    if (!buyerId) return NextResponse.json({ error: "Pending payment has no buyer id" }, { status: 500 })

    // Idempotent: if orders were already created for this reference, return them.
    const existing = await AdminService.getCollection("orders") as Record<string, unknown>[]
    const already = existing.filter(o =>
      (o.cartPaymentRef ?? o.cart_payment_ref) === reference ||
      (o.paymentReference ?? o.payment_reference) === reference
    )
    if (already.length > 0) {
      return NextResponse.json({ success: true, orderIds: already.map(o => o.id) })
    }

    const meta = (() => { try { return JSON.parse(String(payment.metadata ?? "{}")) } catch { return {} } })()
    const cartItems: any[] = Array.isArray(meta.cartItems) ? meta.cartItems : []
    if (!cartItems.length) return NextResponse.json({ error: "No cart items on payment" }, { status: 400 })

    const provider = String(payment.provider ?? "")

    // FIX: this used a sequential `for...of` loop awaiting each seller's
    // setDoc one at a time. For a single-seller cart that's one round-trip
    // to D1 and finishes fine; for a multi-seller cart it's N sequential
    // round-trips, which on a slow/rate-limited connection can push total
    // time past the client's fetch/abort window — the button just spins.
    // Firing all seller writes in parallel with Promise.all fixes this by
    // making total latency ~1 round-trip regardless of seller count.
    const results = await Promise.allSettled(
      cartItems.map(async (group: any) => {
        const { sellerId, sellerName, sellerState, lineItems, deliveryMethod, deliveryFee, subtotal, platformFee, sellerPayout } = group
        const orderId   = crypto.randomUUID()
        const itemTitle = `${sellerName} — ${lineItems?.length ?? 1} item${lineItems?.length === 1 ? "" : "s"}`

        await AdminService.setDoc("orders", orderId, {
          id: orderId, buyer_id: buyerId, buyer_name: meta.buyerName ?? "",
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
        return orderId
      })
    )

    const createdOrderIds = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map(r => r.value)

    const failed = results.filter(r => r.status === "rejected") as PromiseRejectedResult[]
    if (failed.length > 0) {
      console.error("create-pending-orders: some sellers failed:", failed.map(f => f.reason?.message ?? f.reason))
    }

    if (createdOrderIds.length === 0) {
      return NextResponse.json({ error: "Failed to create any orders" }, { status: 500 })
    }

    return NextResponse.json({ success: true, orderIds: createdOrderIds, failedCount: failed.length })
  } catch (err: any) {
    console.error("create-pending-orders error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
