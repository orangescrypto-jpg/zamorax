// app/api/payment/confirm/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"
import { requireAdmin } from "@/lib/auth-server"
import { Emails } from "@/src/services/email"

export async function POST(req: NextRequest) {
  // ── Auth guard: admin only ────────────────────────────────────
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  try {
    const { reference, adminId, purpose, orderId, boostId, adBoostId, subscriptionId } = await req.json()
    if (!reference || !adminId || !purpose)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
    const payment = all.find(r => String(r.reference) === reference)
    if (!payment) return NextResponse.json({ error: `No pending payment for: ${reference}` }, { status: 404 })

    // FIX: rowToDoc converts snake_case → camelCase, so use camelCase field names
    if (payment.adminConfirmed) return NextResponse.json({ error: "Already confirmed" }, { status: 409 })

    // FIX: resolve userId from camelCase (rowToDoc output), fall back to snake_case
    const paymentUserId = String(payment.userId ?? payment.user_id ?? "")

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
      // FIX: use paymentUserId (camelCase-resolved) not payment.user_id
      const buyer = await AdminService.getDoc("users", paymentUserId) as Record<string, unknown> | null
      const order = await AdminService.getDoc("orders", orderId) as Record<string, unknown> | null
      await AdminService.addDoc("notifications", {
        user_id: paymentUserId, type: "system", title: "✅ Payment Confirmed!",
        body: "Admin confirmed your payment. Escrow is now active — the seller will be notified to ship.",
        link: `/dashboard/buyer/orders/${orderId}`, is_read: false,
      })

      // Order Confirmed email — this was previously never sent despite the
      // template/toggle existing. Look the buyer up directly for their email
      // rather than relying on metadata (which doesn't always include it).
      if (paymentUserId) {
        const buyerEmail = String(buyer?.email ?? "")
        if (buyerEmail) {
          Emails.orderConfirmed(buyerEmail, {
            buyerName:   String(buyer?.fullName ?? meta?.buyerName ?? "there"),
            itemTitle:   String(order?.itemTitle ?? meta?.itemTitle ?? "your item"),
            orderId:     orderId,
            totalAmount: `₦${(Number(order?.totalAmount ?? 0) / 100).toLocaleString("en-NG")}`,
            sellerName:  String(order?.sellerName ?? meta?.sellerName ?? "the seller"),
          }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
        }
      }
      if (meta?.sellerId) {
        // FIX: seller previously only got a name — in Nigeria, deals move by
        // phone call/WhatsApp, not by checking an inbox. Include the buyer's
        // phone number now that payment is actually confirmed, so the seller
        // can reach out immediately instead of waiting on email/chat.
        const buyerPhone = String(buyer?.phone ?? meta?.buyerPhone ?? "").trim()
        const buyerName  = String(buyer?.fullName ?? meta?.buyerName ?? "The buyer")
        await AdminService.addDoc("notifications", {
          user_id: meta.sellerId, type: "system", title: "💰 Order Payment Confirmed",
          body: buyerPhone
            ? `Payment confirmed. Escrow is active — please prepare/ship the item. ${buyerName} can be reached on ${buyerPhone}.`
            : "Payment confirmed. Escrow is active — please ship the item.",
          link: `/dashboard/seller/orders/${orderId}`, is_read: false,
        })

        // FIX: seller only ever got the in-app notification above, never an
        // actual email, when payment was confirmed/funded. Most sellers
        // don't have the app open — an email means they find out promptly.
        const seller = await AdminService.getDoc("users", String(meta.sellerId)) as Record<string, unknown> | null
        const sellerEmail = String(seller?.email ?? "")
        if (sellerEmail) {
          Emails.orderFundedSeller(sellerEmail, {
            sellerName:  String(seller?.fullName ?? meta?.sellerName ?? "there"),
            itemTitle:   String(order?.itemTitle ?? meta?.itemTitle ?? "your item"),
            orderId:     orderId,
            totalAmount: `₦${(Number(order?.totalAmount ?? 0) / 100).toLocaleString("en-NG")}`,
            buyerName,
            buyerPhone,
          }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
        }
      }

      // Referral first-order bonus
      if (paymentUserId) {
        const referral = await AdminService.getDoc("referrals", paymentUserId) as Record<string, unknown> | null
        if (referral && !referral.order_reward_paid && referral.referrer_id) {
          const config = await AdminService.getDoc("config", "platform") as Record<string, unknown> | null
          const reward = Number(config?.referralOrderRewardKobo ?? 200000)
          await AdminService.updateDoc("referrals", paymentUserId, {
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
      const zlaOrder = await AdminService.getDoc("orders", orderId) as Record<string, unknown> | null
      if (zlaOrder?.delivery_method === "zamorax_logistics" || zlaOrder?.deliveryMethod === "zamorax_logistics") {
        await AdminService.updateDoc("orders", orderId, { zla_booking_status: "pending" })
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
        ZamoraxLogicClient.bookShipment({
          pickup: { contactName: String(zlaOrder.seller_name ?? zlaOrder.sellerName ?? ""), contactPhone: String(meta?.sellerPhone ?? ""), address: String(meta?.sellerAddress ?? ""), state: String(zlaOrder.seller_state ?? zlaOrder.sellerState ?? ""), city: String(meta?.sellerCity ?? "") },
          delivery: { contactName: String(zlaOrder.buyer_name ?? zlaOrder.buyerName ?? ""), contactPhone: String(meta?.buyerPhone ?? ""), address: String(zlaOrder.delivery_street ? `${zlaOrder.delivery_street}, ${zlaOrder.delivery_city ?? ""}` : meta?.buyerAddress ?? ""), state: String(zlaOrder.buyer_state ?? zlaOrder.buyerState ?? ""), city: String(zlaOrder.delivery_city ?? meta?.buyerCity ?? ""), lga: String(zlaOrder.delivery_lga ?? "") },
          item: { description: String(zlaOrder.item_title ?? zlaOrder.itemTitle ?? ""), weight: Number(zlaOrder.item_weight_kg ?? zlaOrder.itemWeightKg ?? 1), declaredValue: Number(zlaOrder.total_amount ?? zlaOrder.totalAmount ?? 0), fragile: !!(zlaOrder.item_fragile ?? zlaOrder.itemFragile) },
          deliveryType: (zlaOrder.zla_delivery_type ?? zlaOrder.zlaDeliveryType ?? "agent_pickup") as "agent_pickup" | "doorstep",
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
      // FIX: use paymentUserId
      await AdminService.addDoc("notifications", { user_id: paymentUserId, type: "system", title: "📣 Ad Boost Activated!", body: `Your ad campaign for "${adBoost?.productTitle ?? "your product"}" is now active.`, link: "/dashboard/seller/boost", is_read: false })
    }

    if (purpose === "boost" && boostId) {
      const boost = await AdminService.getDoc("boosts", boostId) as Record<string, unknown> | null
      const durationMatch = String(boost?.duration ?? "7 days").match(/(\d+)\s*day/i)
      const durationDays  = durationMatch ? parseInt(durationMatch[1], 10) : 7
      const boostEndsAt   = new Date(Date.now() + durationDays * 86400000).toISOString()
      await AdminService.updateDoc("boosts", boostId, { status: "active", payment_reference: reference, payment_provider: "manual", activated_at: new Date().toISOString(), boost_ends_at: boostEndsAt })
      if (boost?.listingId) await AdminService.updateDoc("listings", String(boost.listingId), { is_boosted: true, boost_expires_at: boostEndsAt })
      // FIX: use paymentUserId
      await AdminService.addDoc("notifications", { user_id: paymentUserId, type: "system", title: "⚡ Boost Activated!", body: `Your listing boost is active for ${durationDays} days.`, link: "/dashboard/seller/boost", is_read: false })
    }

    if (purpose === "subscription" && subscriptionId) {
      const plan = meta?.plan as string
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
      await AdminService.updateDoc("subscriptions", subscriptionId, { status: "active", payment_reference: reference, payment_provider: "manual", activated_at: new Date().toISOString() })
      // FIX: use paymentUserId
      await AdminService.updateDoc("users", paymentUserId, { plan, plan_expires_at: expiresAt })
      await AdminService.addDoc("notifications", { user_id: paymentUserId, type: "system", title: "🎉 Subscription Activated!", body: `Your ${plan} plan is now active.`, link: "/dashboard/seller", is_read: false })
    }

    return NextResponse.json({ success: true, message: `Payment confirmed and ${purpose} updated` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
