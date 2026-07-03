// app/api/cart/confirm/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"
import { d1Query } from "@/lib/d1"
import { Emails } from "@/src/services/email"
import { ChatService } from "@/src/services/chat"

export async function POST(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB

  // Auto-create the buyer<->seller chat for a confirmed cart order — one
  // thread per seller, since a multi-seller cart splits into one order per
  // seller and each needs its own conversation. Previously no automatic
  // chat existed for cart orders at all (single- or multi-seller); a chat
  // only appeared if the buyer had manually messaged that seller before
  // checking out.
  async function createOrderChat(params: {
    orderId: string; sellerId: string; sellerName: string
    listingId: string; itemTitle: string
    buyerId: string; buyerName: string
  }) {
    const { orderId, sellerId, sellerName, listingId, itemTitle, buyerId, buyerName } = params
    if (!sellerId || !listingId || !buyerId || sellerId === buyerId) return
    try {
      const chat = await ChatService.getOrCreateChat({
        listingId, listingTitle: itemTitle, listingImage: null,
        buyerId, buyerName, sellerId, sellerName,
      })
      await ChatService.sendMessage(
        chat.id, "system",
        `Order confirmed — escrow is now active for "${itemTitle}". You can chat here to coordinate delivery.`,
      )
    } catch (err) {
      // non-fatal — buyer/seller can still message manually from the listing
      console.error(`auto chat creation failed (cart/confirm, order ${orderId}):`, err)
    }
  }

  try {
    const { reference, adminId } = await req.json()
    if (!reference || !adminId)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    // Targeted query — no full pending_payments scan
    const result = await d1Query(
      "SELECT * FROM pending_payments WHERE reference = ? LIMIT 1",
      [reference],
      nativeDB,
    )
    const payment = (result?.results ?? [])[0] as Record<string, unknown> | undefined
    if (!payment) return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })
    if (payment.admin_confirmed) return NextResponse.json({ error: "Already confirmed" }, { status: 409 })
    if (payment.purpose !== "cart_order") return NextResponse.json({ error: "Not a cart_order" }, { status: 400 })

    const meta = (() => { try { return JSON.parse(String(payment.metadata ?? "{}")) } catch { return {} } })()
    const cartItems: any[] = Array.isArray(meta.cartItems) ? meta.cartItems : []
    if (!cartItems.length) return NextResponse.json({ error: "No cart items on payment" }, { status: 400 })

    // This route's `payment` comes from a raw d1Query (not AdminService.getCollection),
    // so it's still snake_case — unlike rows from getCollection/rowToDoc elsewhere.
    const buyerId = String(payment.user_id ?? (payment as any).userId ?? "")

    // ── Pre-check stock BEFORE creating any orders ──────────────
    // Prevents confirming an order for items that sold out while payment was pending.
    const stockShortages: string[] = []
    for (const group of cartItems) {
      for (const item of (group.lineItems ?? [])) {
        if (!item.listingId || !item.qty) continue
        const listing = await AdminService.getDoc("listings", item.listingId) as Record<string, unknown> | null
        if (listing && listing.stock_qty != null && Number(listing.stock_qty) < item.qty) {
          stockShortages.push(`${listing.title ?? item.listingId} (only ${listing.stock_qty} left, ${item.qty} requested)`)
        }
      }
    }
    if (stockShortages.length > 0) {
      return NextResponse.json({
        error: "Some items are no longer available in the requested quantity",
        shortages: stockShortages,
      }, { status: 409 })
    }

    await AdminService.updateDoc("pending_payments", String(payment.id), {
      admin_confirmed: true, admin_id: adminId, confirmed_at: new Date().toISOString(), status: "confirmed",
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
    const createdOrderIds: string[] = []
    const emailedOrders: { orderId: string; itemTitle: string; totalAmount: number; sellerName: string }[] = []

    // Orders may already exist (status "pending") if the buyer's "I've Paid"
    // click already created them — just upgrade those to escrow_held instead
    // of creating duplicates. Only fall back to creating fresh orders below
    // for older pending_payments that predate that flow.
    const allOrders = await AdminService.getCollection("orders") as Record<string, unknown>[]
    const existingOrders = allOrders.filter(o => (o.cartPaymentRef ?? o.cart_payment_ref) === reference)

    if (existingOrders.length > 0) {
      for (const order of existingOrders) {
        const orderId = String(order.id)
        await AdminService.updateDoc("orders", orderId, {
          status: "escrow_held", escrow_status: "held",
          escrow_held_at: new Date().toISOString(), payment_provider: "manual",
        })
        createdOrderIds.push(orderId)
        emailedOrders.push({
          orderId,
          itemTitle:   String(order.itemTitle ?? order.item_title ?? "your item"),
          totalAmount: Number(order.totalAmount ?? order.total_amount ?? 0),
          sellerName:  String(order.sellerName ?? order.seller_name ?? "the seller"),
        })

        const lineItems = (() => { try { return JSON.parse(String(order.lineItems ?? order.line_items ?? "[]")) } catch { return [] } })()
        for (const item of lineItems) {
          if (!item.listingId || !item.qty) continue
          try {
            await d1Query(
              `UPDATE listings SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty IS NOT NULL AND stock_qty >= ?`,
              [item.qty, item.listingId, item.qty], nativeDB,
            )
          } catch { /* non-blocking */ }
        }

        const orderDeliveryMethod = String(order.deliveryMethod ?? order.delivery_method ?? "")
        if (orderDeliveryMethod === "zamorax_logistics") {
          await AdminService.updateDoc("orders", orderId, { zla_booking_status: "pending" })
          ZamoraxLogicClient.bookShipment({
            pickup: { contactName: String(order.sellerName ?? order.seller_name ?? ""), contactPhone: "", address: "", state: String(order.sellerState ?? order.seller_state ?? ""), city: "" },
            delivery: { contactName: String(meta.buyerName ?? ""), contactPhone: "", address: `${meta.deliveryStreet ?? ""}, ${meta.deliveryCity ?? ""}`, state: String(meta.deliveryState ?? ""), city: String(meta.deliveryCity ?? ""), lga: String(meta.deliveryLga ?? "") },
            item: { description: String(order.itemTitle ?? order.item_title ?? ""), weight: 1, declaredValue: Number(order.totalAmount ?? order.total_amount ?? 0), fragile: false },
            deliveryType: "agent_pickup", externalOrderId: orderId,
            callbackUrl: `${appUrl}/api/webhooks/zamoraxlogic`,
          }).then(async (r) => {
            await AdminService.updateDoc("orders", orderId, { zla_booking_status: "booked", zla_shipment_id: r.shipmentId, zla_tracking_code: r.trackingCode })
          }).catch(async (e) => {
            await AdminService.updateDoc("orders", orderId, { zla_booking_status: "failed", zla_booking_error: e?.message ?? "Unknown" })
          })
        }

        await AdminService.addDoc("notifications", { user_id: order.sellerId ?? order.seller_id, type: "order_update", title: "🛒 New Cart Order", body: `New order: ${order.itemTitle ?? order.item_title}. Payment confirmed.`, link: `/dashboard/seller/orders/${orderId}`, is_read: false })

        const lineItemsForChat = (() => { try { return JSON.parse(String(order.lineItems ?? order.line_items ?? "[]")) } catch { return [] } })()
        await createOrderChat({
          orderId,
          sellerId:    String(order.sellerId ?? order.seller_id ?? ""),
          sellerName:  String(order.sellerName ?? order.seller_name ?? "Seller"),
          listingId:   String(lineItemsForChat?.[0]?.listingId ?? order.listingId ?? order.listing_id ?? ""),
          itemTitle:   String(order.itemTitle ?? order.item_title ?? "Order"),
          buyerId,
          buyerName:   String(meta.buyerName ?? "Buyer"),
        })
      }
    } else {
    for (const group of cartItems) {
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
        status: "escrow_held", escrow_status: "held", escrow_held_at: new Date().toISOString(),
        order_type: "purchase", payment_reference: reference, payment_provider: "manual",
        cart_payment_ref: reference,
        zla_booking_status: deliveryMethod === "zamorax_logistics" ? "pending" : null,
      })
      createdOrderIds.push(orderId)
      emailedOrders.push({ orderId, itemTitle, totalAmount: subtotal, sellerName })

      // Decrement stock atomically — SQL conditional UPDATE prevents overselling
      // under concurrent checkouts (read-then-write race condition fixed).
      for (const item of (lineItems ?? [])) {
        if (!item.listingId || !item.qty) continue
        try {
          await d1Query(
            `UPDATE listings
             SET stock_qty = stock_qty - ?
             WHERE id = ? AND stock_qty IS NOT NULL AND stock_qty >= ?`,
            [item.qty, item.listingId, item.qty],
            nativeDB,
          )
        } catch { /* non-blocking — order already created, log and reconcile manually if needed */ }
      }

      // ZLA booking
      if (deliveryMethod === "zamorax_logistics") {
        const totalWeight = (lineItems ?? []).reduce((s: number, l: any) => s + ((l.weightKg ?? 0.5) * (l.qty ?? 1)), 0)
        ZamoraxLogicClient.bookShipment({
          pickup: { contactName: sellerName, contactPhone: "", address: "", state: sellerState, city: "" },
          delivery: { contactName: String(meta.buyerName ?? ""), contactPhone: "", address: `${meta.deliveryStreet ?? ""}, ${meta.deliveryCity ?? ""}`, state: String(meta.deliveryState ?? ""), city: String(meta.deliveryCity ?? ""), lga: String(meta.deliveryLga ?? "") },
          item: { description: itemTitle, weight: totalWeight || 1, declaredValue: subtotal, fragile: (lineItems ?? []).some((l: any) => l.isFragile) },
          deliveryType: "agent_pickup", externalOrderId: orderId,
          callbackUrl: `${appUrl}/api/webhooks/zamoraxlogic`,
        }).then(async (r) => {
          await AdminService.updateDoc("orders", orderId, { zla_booking_status: "booked", zla_shipment_id: r.shipmentId, zla_tracking_code: r.trackingCode })
          if (r.originAgent) {
            const line = `Drop off at: ${r.originAgent.name}, ${r.originAgent.address}.`
            await AdminService.addDoc("notifications", { user_id: sellerId, type: "system", title: "📦 Drop Parcel at Agent", body: line, link: `/dashboard/seller/orders/${orderId}`, is_read: false })
          }
        }).catch(async (e) => {
          await AdminService.updateDoc("orders", orderId, { zla_booking_status: "failed", zla_booking_error: e?.message ?? "Unknown" })
        })
      }

      await AdminService.addDoc("notifications", { user_id: sellerId, type: "order_update", title: "🛒 New Cart Order", body: `New order: ${itemTitle}. Payment confirmed.`, link: `/dashboard/seller/orders/${orderId}`, is_read: false })

      await createOrderChat({
        orderId, sellerId, sellerName,
        listingId: String(lineItems?.[0]?.listingId ?? ""),
        itemTitle, buyerId,
        buyerName: String(meta.buyerName ?? "Buyer"),
      })
    }
    } // end else (legacy fallback — no pre-existing orders for this reference)

    // Mark accepted offers used
    for (const group of cartItems) {
      for (const item of (group.lineItems ?? [])) {
        if (item.agreedPrice != null && buyerId) {
          const accepted = await AdminService.getCollection("accepted_offers") as Record<string, unknown>[]
          const match = accepted.find(r => r.listing_id === item.listingId && (r.buyerId ?? r.buyer_id) === buyerId && r.status === "active")
          if (match) await AdminService.updateDoc("accepted_offers", String(match.id), { status: "used", used_at: new Date().toISOString() })
        }
      }
    }

    // Referral bonus
    // buyerId already resolved above
    if (buyerId) {
      const referral = await AdminService.getDoc("referrals", buyerId) as Record<string, unknown> | null
      if (referral && !referral.order_reward_paid && referral.referrer_id) {
        const config = await AdminService.getDoc("config", "platform") as Record<string, unknown> | null
        const reward = Number(config?.referralOrderRewardKobo ?? 200000)
        await AdminService.updateDoc("referrals", buyerId, { order_reward_paid: true, status: "ordered", order_reward_paid_at: new Date().toISOString() })
        const wallet = await AdminService.getDoc("agent_wallets", String(referral.referrer_id)) as Record<string, unknown> | null
        await AdminService.setDoc("agent_wallets", String(referral.referrer_id), { balance: Number(wallet?.balance ?? 0) + reward, total_earned: Number(wallet?.total_earned ?? 0) + reward, owner_id: referral.referrer_id }, { merge: true })
      }
    }

    // Order Confirmed email — previously never sent despite the template and
    // toggle existing, because nothing ever called Emails.orderConfirmed.
    // Cart checkout already captured the buyer's email in metadata.
    const buyerEmail = String(meta.buyerEmail ?? "")
    if (buyerEmail) {
      for (const o of emailedOrders) {
        Emails.orderConfirmed(buyerEmail, {
          buyerName:   String(meta.buyerName ?? "there"),
          itemTitle:   o.itemTitle,
          orderId:     o.orderId,
          totalAmount: `₦${(o.totalAmount / 100).toLocaleString("en-NG")}`,
          sellerName:  o.sellerName,
        }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
      }
    }

    await AdminService.addDoc("notifications", { user_id: buyerId, type: "order_update", title: `✅ ${createdOrderIds.length} order${createdOrderIds.length !== 1 ? "s" : ""} confirmed`, body: `Your cart order (${reference}) is confirmed. Track orders in your dashboard.`, link: "/dashboard/buyer/orders", is_read: false })

    return NextResponse.json({ success: true, orderCount: createdOrderIds.length, orderIds: createdOrderIds })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
