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
import { d1Query } from "@/lib/d1"
import { decrementStock } from "@/lib/stockManagement"
import { requireAuth } from "@/lib/auth-server"
import { getCronSecret } from "@/lib/cron-secret"
import { findOrdersByPaymentReference } from "@/lib/server/order-lookup"
import { orderMoneyFromSubtotal, verifyCartPayment, type PinnedCart } from "@/lib/server/order-pricing"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  // Called two ways: by the buyer's browser after redirect (session cookie),
  // or by the Flutterwave webhook's fallback path, which has no session but
  // presents the same secret used to gate the cron endpoints.
  const internalSecret = req.headers.get("x-internal-secret")
  const cronSecret = internalSecret ? await getCronSecret(nativeDB) : null
  const isInternalCall = !!internalSecret && !!cronSecret && internalSecret === cronSecret

  let sessionUid: string | null = null
  if (!isInternalCall) {
    const auth = await requireAuth(req)
    if (!auth.ok) return auth.error
    sessionUid = auth.uid
  }

  try {
    const { reference } = await req.json()
    if (!reference) {
      return NextResponse.json({ error: "Missing reference" }, { status: 400 })
    }

    const res: any = await d1Query("SELECT * FROM pending_payments WHERE reference = ? LIMIT 1", [reference], nativeDB)
    const payment = ((res?.results ?? [])[0]) as Record<string, unknown> | undefined
    if (!payment) return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })

    const buyerId = String(payment.user_id ?? "")
    if (!buyerId) return NextResponse.json({ error: "Pending payment has no buyer id" }, { status: 500 })
    if (sessionUid && buyerId !== sessionUid) {
      return NextResponse.json({ error: "This payment belongs to a different account." }, { status: 403 })
    }

    // Idempotent: if orders were already created for this reference, return them.
    const already = await findOrdersByPaymentReference(reference, nativeDB)
    if (already.length > 0) {
      return NextResponse.json({ success: true, orderIds: already.map(o => o.id) })
    }

    const meta = (() => { try { return JSON.parse(String(payment.metadata ?? "{}")) } catch { return {} } })()
    const cartItems: any[] = Array.isArray(meta.cartItems) ? meta.cartItems : []
    if (!cartItems.length) return NextResponse.json({ error: "No cart items on payment" }, { status: 400 })

    const provider = String(payment.provider ?? "")

    // The per-seller totals used below to write order rows come from HERE,
    // not from meta.cartItems: `pending` is server-derived at /api/payment/
    // initialize (see lib/server/order-pricing.ts) and travels inside the
    // gateway's own metadata, so the browser cannot alter it after that
    // point. Manual (bank-transfer) payments never go through initialize —
    // for those, re-verify against live listing data now.
    let pinned: PinnedCart | null = (meta.zmxExpected && meta.zmxExpected.groups) ? meta.zmxExpected as PinnedCart : null
    if (!pinned) {
      const claimedTotal = Number(payment.amount ?? 0)
      const checked = await verifyCartPayment(cartItems, {
        buyerUid: buyerId,
        claimedTotalKobo: claimedTotal,
        buyerState: String(meta.deliveryState ?? meta.buyerState ?? ""),
        nativeDB,
      })
      if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status })
      pinned = checked.pinned
    }

    // Never create order rows for an online gateway (Paystack/Flutterwave)
    // until the payment has actually been verified as successful. Orders
    // used to be created "pending" right before redirect and relied on a
    // later re-verify (activate-paystack) to flip them — but that meant a
    // buyer who abandoned or failed checkout still had order rows sitting
    // in the database as if a sale had happened. For online providers, we
    // verify with the gateway first and refuse to create anything if the
    // payment didn't go through. Manual (bank transfer) is unaffected —
    // those are still created pending, since a human admin confirms them.
    let flwTransactionId: number | null = null
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
          // Needed later to call /transactions/escrow/settle when each
          // seller's portion of this cart order is released.
          flwTransactionId = data.data?.id ?? null
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
        const { sellerId, sellerName, sellerState, lineItems, deliveryMethod } = group
        const orderId: string = crypto.randomUUID()
        // Money for this seller's order comes only from the pinned figures,
        // never from the group object the client/metadata carried.
        const pin = pinned!.groups[String(sellerId)]
        if (!pin) throw new Error(`No verified pricing for seller ${sellerId}`)
        const subtotal = pin.subtotalKobo
        const deliveryFee = pin.deliveryFeeKobo
        const { platformFee, sellerPayout } = await orderMoneyFromSubtotal(subtotal)
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
          // FIX: item_price was never set on cart orders — only total_amount.
          // Reads happened to still work via mapRow()'s item_price ?? total_amount
          // fallback, but that's fragile (anything that reads the raw D1 row
          // directly, bypassing that provider function, would see a NULL
          // item_price). Set it explicitly to the same pre-fee subtotal so
          // Gross Sales always has a real per-order value to sum.
          item_price: subtotal,
          total_amount: subtotal, platform_fee: platformFee, seller_payout: sellerPayout,
          delivery_method: deliveryMethod, delivery_fee: deliveryFee ?? 0,
          delivery_street: meta.deliveryStreet ?? "", delivery_city: meta.deliveryCity ?? "",
          delivery_state: meta.deliveryState ?? "", delivery_lga: meta.deliveryLga ?? "",
          delivery_phone: meta.deliveryPhone ?? "",
          status: isOnlineVerified ? "escrow_held" : "pending",
          escrow_status: isOnlineVerified ? "held" : "pending",
          escrow_held_at: isOnlineVerified ? new Date().toISOString() : null,
          order_type: "purchase", payment_reference: reference, payment_provider: provider,
          cart_payment_ref: reference,
          flw_transaction_id: provider === "flutterwave" ? flwTransactionId : null,
          is_offer_order: offerLineItems.length > 0,
          offer_id: offerLineItems[0]?.offerId ?? null,
        })

        // Decrement stock — only for online providers, since this order
        // goes straight to escrow_held (payment already verified above).
        // Manual (bank transfer) orders stay "pending" here and get their
        // stock decremented later in /api/cart/confirm when an admin
        // confirms the transfer — decrementing here too would double-count.
        // This route writes orders directly via setDoc (bypassing
        // OrdersService.createOrder), so it never ran the atomic decrement.
        if (isOnlineVerified) {
          for (const item of (lineItems ?? [])) {
            if (!item.listingId || !item.qty) continue
            try {
              await decrementStock(item.listingId, item.qty)
            } catch (err) {
              console.error(`create-pending-orders: stock decrement failed for ${item.listingId}:`, err)
            }
          }
        }

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
