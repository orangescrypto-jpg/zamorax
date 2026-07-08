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

    // Never create order rows for an online gateway (Paystack/Flutterwave)
    // until the payment has actually been verified as successful. Orders
    // used to be created "pending" right before redirect and relied on a
    // later re-verify (activate-paystack) to flip them — but that meant a
    // buyer who abandoned or failed checkout still had order rows sitting
    // in the database as if a sale had happened. For online providers, we
    // verify with the gateway first and refuse to create anything if the
    // payment didn't go through. Manual (bank transfer) is unaffected —
    // those are still created pending, since a human admin confirms them.
    if (provider === "paystack" || provider === "flutterwave") {
      const secretKey = provider === "paystack" ? process.env.PAYSTACK_SECRET_KEY : process.env.FLW_SECRET_KEY
      if (!secretKey) {
        return NextResponse.json({ error: `${provider} secret key not configured` }, { status: 500 })
      }
      try {
        if (provider === "paystack") {
          const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
          })
          const data = await res.json()
          if (!data.status || data.data?.status !== "success") {
            return NextResponse.json({ error: "Payment not verified — no order was created." }, { status: 402 })
          }
        } else {
          const res = await fetch(
            `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
            { headers: { Authorization: `Bearer ${secretKey}` } },
          )
          const data = await res.json()
          if (data.status !== "success" || data.data?.status !== "successful") {
            return NextResponse.json({ error: "Payment not verified — no order was created." }, { status: 402 })
          }
        }
      } catch (err: any) {
        console.error("create-pending-orders: gateway verify failed:", err)
        return NextResponse.json({ error: "Could not verify payment — no order was created." }, { status: 502 })
      }
    }

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
        // Use the actual product name(s), not "SellerName — N item(s)" —
        // buyers want to see what they bought, not who they bought it from.
        // Single item: just the title. Multiple: first title + "& N more".
        const titles = (lineItems ?? []).map((li: any) => String(li.title ?? "").trim()).filter(Boolean)
        const itemTitle =
          titles.length === 0 ? "Order" :
          titles.length === 1 ? titles[0] :
          `${titles[0]} & ${titles.length - 1} more item${titles.length - 1 === 1 ? "" : "s"}`

        // For online providers (paystack/flutterwave) we've already verified
        // the payment succeeded above, so the order can go straight to
        // escrow_held — there's no unpaid window. Manual transfers still
        // land as pending, awaiting admin confirmation.
        const isOnlineVerified = provider === "paystack" || provider === "flutterwave"

        // If any line item in this seller's group was bought at a
        // negotiated (agreedPrice) price, tag the order as an offer order
        // and mark that offer used so the buyer can't reuse the same
        // accepted offer again from a later cart checkout. Buy Now already
        // does this — cart checkout was silently skipping it.
        const offerLineItems = (lineItems ?? []).filter((li: any) => li.agreedPrice != null && li.offerId)

        await AdminService.setDoc("orders", orderId, {
          id: orderId, buyer_id: buyerId, buyer_name: meta.buyerName ?? "",
          seller_id: sellerId, seller_name: sellerName, seller_state: sellerState,
          listing_id: lineItems?.[0]?.listingId ?? "", item_title: itemTitle,
          line_items: JSON.stringify(lineItems ?? []),
          total_amount: subtotal, platform_fee: platformFee, seller_payout: sellerPayout,
          delivery_method: deliveryMethod, delivery_fee: deliveryFee ?? 0,
          delivery_street: meta.deliveryStreet ?? "", delivery_city: meta.deliveryCity ?? "",
          delivery_state: meta.deliveryState ?? "", delivery_lga: meta.deliveryLga ?? "",
          status: isOnlineVerified ? "escrow_held" : "pending",
          escrow_status: isOnlineVerified ? "held" : "pending",
          escrow_held_at: isOnlineVerified ? new Date().toISOString() : null,
          order_type: "purchase", payment_reference: reference, payment_provider: provider,
          cart_payment_ref: reference,
          is_offer_order: offerLineItems.length > 0,
          offer_id: offerLineItems[0]?.offerId ?? null,
        })

        if (offerLineItems.length > 0) {
          try {
            const { OffersService } = await import("@/src/services")
            await Promise.all(
              offerLineItems.map((li: any) => OffersService.markOfferUsed(li.listingId, buyerId)),
            )
          } catch (err) {
            console.error("create-pending-orders: markOfferUsed failed (non-fatal):", err)
          }
        }
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

    // For online providers, the payment is already verified — there's
    // nothing left for an admin to manually confirm. Without this, the
    // pending_payments row (written by CartCheckoutModal before redirect)
    // sits forever at status "awaiting_transfer" / adminConfirmed=false,
    // showing up in /admin/payments as if it still needs a human to check
    // a bank transfer, even though the orders are already escrow_held.
    // Manual (bank transfer) payments are untouched — those genuinely do
    // need an admin to confirm, via /api/cart/confirm.
    if (provider === "paystack" || provider === "flutterwave") {
      await AdminService.updateDoc("pending_payments", String(payment.id), {
        status: "confirmed",
        adminConfirmed: true,
      }).catch((err) => {
        // Non-fatal — orders are already created and correct; this only
        // affects the admin payments list's display, which will just show
        // a stale "pending" row an admin can ignore (it has no confirm
        // action available for provider=paystack once that filter lands).
        console.error("create-pending-orders: failed to mark pending_payment confirmed:", err)
      })
    }

    return NextResponse.json({ success: true, orderIds: createdOrderIds, failedCount: failed.length })
  } catch (err: any) {
    console.error("create-pending-orders error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
