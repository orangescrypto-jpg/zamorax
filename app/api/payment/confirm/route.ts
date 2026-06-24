// app/api/payment/confirm/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"

export async function POST(req: NextRequest) {
  try {
    const { reference, adminId, purpose, orderId, boostId, adBoostId, subscriptionId } = await req.json()
    if (!reference || !adminId || !purpose)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
    const payment = all.find(r => String(r.reference) === reference)
    if (!payment) return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })
    if (payment.admin_confirmed) return NextResponse.json({ error: "Already confirmed" }, { status: 409 })

    const meta = (() => { try { return JSON.parse(String(payment.metadata ?? "{}")); } catch { return {} } })()

    await AdminService.updateDoc("pending_payments", String(payment.id), {
      admin_confirmed: true, admin_id: adminId,
      confirmed_at: new Date().toISOString(), status: "confirmed",
    })

    if (purpose === "order" && orderId) {
      await AdminService.updateDoc("orders", orderId, {
        status: "escrow_held", escrow_status: "held",
        escrow_held_at: new Date().toISOString(),
        payment_reference: reference, payment_provider: "manual",
      })
      await AdminService.addDoc("notifications", {
        user_id: payment.user_id, type: "system", title: "✅ Payment Confirmed!",
        body: "Admin confirmed your payment. Escrow is now active — the seller will be notified to ship.",
        link: `/dashboard/buyer/orders/${orderId}`, is_read: false,
      })
      if (meta?.sellerId) {
        await AdminService.addDoc("notifications", {
          user_id: meta.sellerId, type: "system", title: "💰 Order Payment Confirmed",
          body: "Payment confirmed. Escrow is active — please ship the item.",
          link: `/dashboard/seller/orders/${orderId}`, is_read: false,
        })
      }

      // Referral first-order bonus
      const buyerId = String(payment.user_id ?? "")
      if (buyerId) {
        const referral = await AdminService.getDoc("referrals", buyerId) as Record<string, unknown> | null
        if (referral && !referral.order_reward_paid && referral.referrer_id) {
          const config = await AdminService.getDoc("config", "platform") as Record<string, unknown> | null
          const reward = Number(config?.referralOrderRewardKobo ?? 200000)
          await AdminService.updateDoc("referrals", buyerId, {
            order_reward_paid: true, status: "ordered", order_reward_paid_at: new Date().toISOString(),
          })
          const wallet = await AdminService.getDoc("agent_wallets", String(referral.referrer_id)) as Record<string, unknown> | null
          const bal = Number(wallet?.balance ?? 0); const earned = Number(wallet?.total_earned ?? 0)
          await AdminService.setDoc("agent_wallets", String(referral.referrer_id), {
            balance: bal + reward, total_earned: earned + reward, owner_id: referral.referrer_id,
          }, { merge: true })
          await AdminService.addDoc("notifications", {
            user_id: referral.referrer_id, type: "system", title: "🎉 Referral Reward Earned!",
            body: `Someone you referred placed their first order. ₦${(reward/100).toLocaleString()} added to your referral wallet.`,
            link: "/dashboard/referrals", is_read: false,
          })
        }
      }

      // ZamoraxLogic booking
      const order = await AdminService.getDoc("orders", orderId) as Record<string, unknown> | null
      if (order?.delivery_method === "zamorax_logistics" || order?.deliveryMethod === "zamorax_logistics") {
        await AdminService.updateDoc("orders", orderId, { zla_booking_status: "pending" })
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
        ZamoraxLogicClient.bookShipment({
          pickup: { contactName: String(order.seller_name ?? order.sellerName ?? ""), contactPhone: String(meta?.sellerPhone ?? ""), address: String(meta?.sellerAddress ?? ""), state: String(order.seller_state ?? order.sellerState ?? ""), city: String(meta?.sellerCity ?? "") },
          delivery: { contactName: String(order.buyer_name ?? order.buyerName ?? ""), contactPhone: String(meta?.buyerPhone ?? ""), address: String(order.delivery_street ? `${order.delivery_street}, ${order.delivery_city ?? ""}` : meta?.buyerAddress ?? ""), state: String(order.buyer_state ?? order.buyerState ?? ""), city: String(order.delivery_city ?? meta?.buyerCity ?? ""), lga: String(order.delivery_lga ?? "") },
          item: { description: String(order.item_title ?? order.itemTitle ?? ""), weight: Number(order.item_weight_kg ?? order.itemWeightKg ?? 1), declaredValue: Number(order.total_amount ?? order.totalAmount ?? 0), fragile: !!(order.item_fragile ?? order.itemFragile) },
          deliveryType: (order.zla_delivery_type ?? order.zlaDeliveryType ?? "agent_pickup") as "agent_pickup" | "doorstep",
          externalOrderId: orderId,
          callbackUrl: `${appUrl}/api/webhooks/zamoraxlogic`,
        }).then(async (zlaRes) => {
          await AdminService.updateDoc("orders", orderId, {
            zla_booking_status: "booked", zla_shipment_id: zlaRes.shipmentId,
            zla_tracking_code: zlaRes.trackingCode, logistics_provider: "zamorax_logistics",
          })
        }).catch(async (err) => {
          await AdminService.updateDoc("orders", orderId, {
            zla_booking_status: "failed", zla_booking_error: err?.message ?? "Unknown",
          })
        })
      }
    }

    if (purpose === "boost" && adBoostId) {
      const adBoost = await AdminService.getDoc("adBoosts", adBoostId) as Record<string, unknown> | null
      await AdminService.updateDoc("adBoosts", adBoostId, { status: "active", payment_reference: reference, payment_provider: "manual", activated_at: new Date().toISOString() })
      if (adBoost?.productId) await AdminService.updateDoc("listings", String(adBoost.productId), { ad_boost_status: "active" })
      await AdminService.addDoc("notifications", { user_id: payment.user_id, type: "system", title: "📣 Ad Boost Activated!", body: `Your ad campaign for "${adBoost?.productTitle ?? "your product"}" is now active.`, link: "/dashboard/seller/boost", is_read: false })
    }

    if (purpose === "boost" && boostId) {
      const boost = await AdminService.getDoc("boosts", boostId) as Record<string, unknown> | null
      const durationMatch = String(boost?.duration ?? "7 days").match(/(\d+)\s*day/i)
      const durationDays  = durationMatch ? parseInt(durationMatch[1], 10) : 7
      const boostEndsAt   = new Date(Date.now() + durationDays * 86400000).toISOString()
      await AdminService.updateDoc("boosts", boostId, { status: "active", payment_reference: reference, payment_provider: "manual", activated_at: new Date().toISOString(), boost_ends_at: boostEndsAt })
      if (boost?.listingId) await AdminService.updateDoc("listings", String(boost.listingId), { is_boosted: true, boost_expires_at: boostEndsAt })
      await AdminService.addDoc("notifications", { user_id: payment.user_id, type: "system", title: "⚡ Boost Activated!", body: `Your listing boost is active for ${durationDays} days.`, link: "/dashboard/seller/boost", is_read: false })
    }

    if (purpose === "subscription" && subscriptionId) {
      const plan = meta?.plan as string
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
      await AdminService.updateDoc("subscriptions", subscriptionId, { status: "active", payment_reference: reference, payment_provider: "manual", activated_at: new Date().toISOString() })
      await AdminService.updateDoc("users", String(payment.user_id), { plan, plan_expires_at: expiresAt })
      await AdminService.addDoc("notifications", { user_id: payment.user_id, type: "system", title: "🎉 Subscription Activated!", body: `Your ${plan} plan is now active.`, link: "/dashboard/seller", is_read: false })
    }

    return NextResponse.json({ success: true, message: `Payment confirmed and ${purpose} updated` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
