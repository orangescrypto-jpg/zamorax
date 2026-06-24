// app/api/cart/confirm/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"

export async function POST(req: NextRequest) {
  try {
    const { reference, adminId } = await req.json()
    if (!reference || !adminId)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
    const payment = all.find(r => String(r.reference) === reference)
    if (!payment) return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })
    if (payment.admin_confirmed) return NextResponse.json({ error: "Already confirmed" }, { status: 409 })
    if (payment.purpose !== "cart_order") return NextResponse.json({ error: "Not a cart_order" }, { status: 400 })

    const cartItems: any[] = (() => { try { return JSON.parse(String(payment.cart_items ?? payment.cartItems ?? "[]")) } catch { return [] } })()
    if (!cartItems.length) return NextResponse.json({ error: "No cart items on payment" }, { status: 400 })

    await AdminService.updateDoc("pending_payments", String(payment.id), {
      admin_confirmed: true, admin_id: adminId, confirmed_at: new Date().toISOString(), status: "confirmed",
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
    const createdOrderIds: string[] = []

    for (const group of cartItems) {
      const { sellerId, sellerName, sellerState, lineItems, deliveryMethod, deliveryFee, subtotal, platformFee, sellerPayout } = group
      const orderId   = crypto.randomUUID()
      const itemTitle = `${sellerName} — ${lineItems?.length ?? 1} item${lineItems?.length === 1 ? "" : "s"}`

      await AdminService.setDoc("orders", orderId, {
        id: orderId, buyer_id: payment.user_id, buyer_name: payment.buyer_name ?? "",
        seller_id: sellerId, seller_name: sellerName, seller_state: sellerState,
        listing_id: lineItems?.[0]?.listingId ?? "", item_title: itemTitle,
        line_items: JSON.stringify(lineItems ?? []),
        total_amount: subtotal, platform_fee: platformFee, seller_payout: sellerPayout,
        delivery_method: deliveryMethod, delivery_fee: deliveryFee ?? 0,
        delivery_street: payment.delivery_street ?? "", delivery_city: payment.delivery_city ?? "",
        delivery_state: payment.delivery_state ?? "", delivery_lga: payment.delivery_lga ?? "",
        status: "escrow_held", escrow_status: "held", escrow_held_at: new Date().toISOString(),
        order_type: "purchase", payment_reference: reference, payment_provider: "manual",
        cart_payment_ref: reference,
        zla_booking_status: deliveryMethod === "zamorax_logistics" ? "pending" : null,
      })
      createdOrderIds.push(orderId)

      // Decrement stock
      for (const item of (lineItems ?? [])) {
        if (!item.listingId || !item.qty) continue
        try {
          const listing = await AdminService.getDoc("listings", item.listingId) as Record<string, unknown> | null
          if (listing && listing.stock_qty != null) {
            await AdminService.updateDoc("listings", item.listingId, { stock_qty: Math.max(0, Number(listing.stock_qty) - item.qty) })
          }
        } catch { /* non-blocking */ }
      }

      // ZLA booking
      if (deliveryMethod === "zamorax_logistics") {
        const totalWeight = (lineItems ?? []).reduce((s: number, l: any) => s + ((l.weightKg ?? 0.5) * (l.qty ?? 1)), 0)
        ZamoraxLogicClient.bookShipment({
          pickup: { contactName: sellerName, contactPhone: "", address: "", state: sellerState, city: "" },
          delivery: { contactName: String(payment.buyer_name ?? ""), contactPhone: "", address: `${payment.delivery_street ?? ""}, ${payment.delivery_city ?? ""}`, state: String(payment.delivery_state ?? ""), city: String(payment.delivery_city ?? ""), lga: String(payment.delivery_lga ?? "") },
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
    }

    // Mark accepted offers used
    for (const group of cartItems) {
      for (const item of (group.lineItems ?? [])) {
        if (item.agreedPrice != null && payment.user_id) {
          const accepted = await AdminService.getCollection("accepted_offers") as Record<string, unknown>[]
          const match = accepted.find(r => r.listing_id === item.listingId && r.buyer_id === payment.user_id && r.status === "active")
          if (match) await AdminService.updateDoc("accepted_offers", String(match.id), { status: "used", used_at: new Date().toISOString() })
        }
      }
    }

    // Referral bonus
    const buyerId = String(payment.user_id ?? "")
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

    await AdminService.addDoc("notifications", { user_id: payment.user_id, type: "order_update", title: `✅ ${createdOrderIds.length} order${createdOrderIds.length !== 1 ? "s" : ""} confirmed`, body: `Your cart order (${reference}) is confirmed. Track orders in your dashboard.`, link: "/dashboard/buyer/orders", is_read: false })

    return NextResponse.json({ success: true, orderCount: createdOrderIds.length, orderIds: createdOrderIds })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
