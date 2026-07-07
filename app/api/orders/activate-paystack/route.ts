// app/api/orders/activate-paystack/route.ts
// ─────────────────────────────────────────────────────────────────
// Auto-activates a Paystack-paid order without waiting on an admin.
//
// Why this exists: manual (bank transfer) orders go through
// /api/payment/confirm, which an admin triggers after eyeballing a
// transfer. Paystack orders don't need a human in the loop — Paystack
// already tells us definitively whether the money moved — but nothing
// was ever calling /api/payment/verify after the checkout redirect, so
// Paystack orders sat at status "pending" until an admin manually
// confirmed them, same as a bank transfer.
//
// This route is called from the buyer orders list page (which is where
// both BuyNowModal and CartCheckoutModal redirect back to after Paystack
// checkout) for every order still "pending" with payment_provider
// "paystack". It re-verifies directly against Paystack's API (never
// trusts the client), then applies the same escrow-activation side
// effects /api/payment/confirm applies for manual orders: notification,
// buyer/seller chat, confirmation + funded-seller emails (with buyer
// phone, since Nigerian sellers coordinate by phone/WhatsApp), referral
// first-order bonus, and ZamoraxLogic booking if applicable.
//
// Scoped to the buyer's own order (not admin-only) since this needs to
// run from the buyer's browser right after their own checkout.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"
import { Emails } from "@/src/services/email"
import { ChatService } from "@/src/services/chat"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function verifyPaystack(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || "Paystack verification failed")
  return { verified: data.data.status === "success", amount: data.data.amount as number }
}

function row1(result: any): Record<string, unknown> | null {
  return (result?.results?.[0] ?? null) as Record<string, unknown> | null
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { orderId, reference } = await req.json()
    if (!orderId || !reference) {
      return NextResponse.json({ error: "orderId and reference required" }, { status: 400 })
    }

    const order = row1(await d1Query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId], nativeDB))
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Only the buyer who placed this order can trigger its own activation.
    const buyerId = String(order.buyer_id ?? order.buyerId ?? "")
    if (buyerId !== auth.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }

    // Idempotent — safe to call repeatedly (e.g. list page re-scans on every load).
    if (String(order.status ?? "") === "escrow_held") {
      return NextResponse.json({ success: true, alreadyActive: true })
    }
    if (String(order.payment_provider ?? "") !== "paystack") {
      return NextResponse.json({ error: "Not a Paystack order" }, { status: 400 })
    }
    // Reference must match what's stamped on the order — a buyer can't
    // activate their order with an unrelated (possibly unpaid) reference.
    const orderRef = String(order.payment_reference ?? "")
    if (orderRef && orderRef !== reference) {
      return NextResponse.json({ error: "Reference mismatch" }, { status: 409 })
    }

    const { verified } = await verifyPaystack(reference)
    if (!verified) {
      return NextResponse.json({ error: "Payment not verified yet" }, { status: 409 })
    }

    const now = new Date().toISOString()
    await d1Query(
      `UPDATE orders SET status = ?, escrow_status = ?, escrow_held_at = ?, payment_reference = ?, payment_provider = ? WHERE id = ?`,
      ["escrow_held", "held", now, reference, "paystack", orderId],
      nativeDB,
    )

    const buyer = row1(await d1Query("SELECT * FROM users WHERE uid = ? LIMIT 1", [buyerId], nativeDB))
    const sellerId = String(order.seller_id ?? order.sellerId ?? "")
    const listingId = String(order.listing_id ?? order.listingId ?? "")
    const itemTitle = String(order.item_title ?? order.itemTitle ?? "your item")
    const totalAmount = Number(order.total_amount ?? order.totalAmount ?? 0)

    await d1Query(
      `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(), buyerId, "system", "✅ Payment Confirmed!",
        "Payment confirmed. Escrow is now active — the seller will be notified to ship.",
        `/dashboard/buyer/orders/${orderId}`, 0, now,
      ],
      nativeDB,
    )

    // Auto-create buyer<->seller chat, same as manual confirmation.
    if (sellerId && listingId && sellerId !== buyerId) {
      try {
        const chat = await ChatService.getOrCreateChat({
          listingId,
          listingTitle: itemTitle,
          listingImage: (order.listing_image ?? order.listingImage ?? null) as string | null,
          buyerId,
          buyerName: String(buyer?.full_name ?? buyer?.fullName ?? "Buyer"),
          sellerId,
          sellerName: String(order.seller_name ?? order.sellerName ?? "Seller"),
        })
        await ChatService.sendMessage(
          chat.id, "system",
          `Order confirmed — escrow is now active for "${itemTitle}". You can chat here to coordinate delivery.`,
        )
      } catch (err) {
        console.error("auto chat creation failed (orders/activate-paystack):", err)
      }
    }

    // Order confirmed email to buyer.
    const buyerEmail = String(buyer?.email ?? "")
    if (buyerEmail) {
      Emails.orderConfirmed(buyerEmail, {
        buyerName: String(buyer?.full_name ?? buyer?.fullName ?? "there"),
        itemTitle, orderId,
        totalAmount: `₦${(totalAmount / 100).toLocaleString("en-NG")}`,
        sellerName: String(order.seller_name ?? order.sellerName ?? "the seller"),
      }).catch(() => {})
    }

    // Seller notification + email, including buyer phone for WhatsApp/call coordination.
    if (sellerId) {
      const buyerPhone = String(buyer?.phone ?? "").trim()
      const buyerName = String(buyer?.full_name ?? buyer?.fullName ?? "The buyer")
      await d1Query(
        `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(), sellerId, "system", "💰 Order Payment Confirmed",
          buyerPhone
            ? `Payment confirmed. Escrow is active — please prepare/ship the item. ${buyerName} can be reached on ${buyerPhone}.`
            : "Payment confirmed. Escrow is active — please ship the item.",
          `/dashboard/seller/orders/${orderId}`, 0, now,
        ],
        nativeDB,
      )

      const seller = row1(await d1Query("SELECT * FROM users WHERE uid = ? LIMIT 1", [sellerId], nativeDB))
      const sellerEmail = String(seller?.email ?? "")
      if (sellerEmail) {
        Emails.orderFundedSeller(sellerEmail, {
          sellerName: String(seller?.full_name ?? seller?.fullName ?? "there"),
          itemTitle, orderId,
          totalAmount: `₦${(totalAmount / 100).toLocaleString("en-NG")}`,
          buyerName, buyerPhone,
        }).catch(() => {})
      }
    }

    // Referral first-order bonus.
    const referral = row1(await d1Query("SELECT * FROM referrals WHERE id = ? LIMIT 1", [buyerId], nativeDB))
    if (referral && !referral.order_reward_paid && referral.referrer_id) {
      const config = row1(await d1Query("SELECT * FROM config WHERE id = ? LIMIT 1", ["platform"], nativeDB))
      const reward = Number((config as any)?.referral_order_reward_kobo ?? 200000)
      await d1Query(
        `UPDATE referrals SET order_reward_paid = ?, status = ?, order_reward_paid_at = ? WHERE id = ?`,
        [1, "ordered", now, buyerId], nativeDB,
      )
      // agent_wallets is keyed by user_id (the referrer), not a separate id/owner_id column.
      const wallet = row1(await d1Query("SELECT * FROM agent_wallets WHERE user_id = ? LIMIT 1", [String(referral.referrer_id)], nativeDB))
      const bal = Number(wallet?.balance ?? 0)
      const earned = Number(wallet?.total_earned ?? 0)
      if (wallet) {
        await d1Query(
          `UPDATE agent_wallets SET balance = ?, total_earned = ? WHERE user_id = ?`,
          [bal + reward, earned + reward, String(referral.referrer_id)], nativeDB,
        )
      } else {
        await d1Query(
          `INSERT INTO agent_wallets (user_id, balance, total_earned) VALUES (?, ?, ?)`,
          [String(referral.referrer_id), reward, reward], nativeDB,
        )
      }
      await d1Query(
        `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(), referral.referrer_id, "system", "🎉 Referral Reward Earned!",
          `Someone you referred placed their first order. ₦${(reward / 100).toLocaleString()} added to your referral wallet.`,
          "/dashboard/referrals", 0, now,
        ],
        nativeDB,
      )
    }

    // ZamoraxLogic booking, if this order uses in-house logistics.
    const deliveryMethod = String(order.delivery_method ?? order.deliveryMethod ?? "")
    if (deliveryMethod === "zamorax_logistics") {
      await d1Query(`UPDATE orders SET zla_booking_status = ? WHERE id = ?`, ["pending", orderId], nativeDB)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
      ZamoraxLogicClient.bookShipment({
        pickup: {
          contactName: String(order.seller_name ?? order.sellerName ?? ""),
          contactPhone: "", address: "",
          state: String(order.seller_state ?? order.sellerState ?? ""), city: "",
        },
        delivery: {
          contactName: String(order.buyer_name ?? order.buyerName ?? ""),
          contactPhone: String(buyer?.phone ?? ""),
          address: order.delivery_street ? `${order.delivery_street}, ${order.delivery_city ?? ""}` : "",
          state: String(order.buyer_state ?? order.buyerState ?? ""),
          city: String(order.delivery_city ?? ""),
          lga: String(order.delivery_lga ?? ""),
        },
        item: {
          description: itemTitle,
          weight: Number(order.item_weight_kg ?? order.itemWeightKg ?? 1),
          declaredValue: totalAmount,
          fragile: !!(order.item_fragile ?? order.itemFragile),
        },
        deliveryType: (order.zla_delivery_type ?? order.zlaDeliveryType ?? "agent_pickup") as "agent_pickup" | "doorstep",
        externalOrderId: orderId,
        callbackUrl: `${appUrl}/api/webhooks/zamoraxlogic`,
      }).then(async (zlaRes) => {
        await d1Query(
          `UPDATE orders SET zla_booking_status = ?, zla_shipment_id = ?, zla_tracking_code = ?, logistics_provider = ? WHERE id = ?`,
          ["booked", zlaRes.shipmentId, zlaRes.trackingCode, "zamorax_logistics", orderId], nativeDB,
        )
      }).catch(async (err) => {
        await d1Query(
          `UPDATE orders SET zla_booking_status = ?, zla_booking_error = ? WHERE id = ?`,
          ["failed", err?.message ?? "Unknown", orderId], nativeDB,
        )
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[POST /api/orders/activate-paystack]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
