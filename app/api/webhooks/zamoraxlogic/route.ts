// app/api/webhooks/zamoraxlogic/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"
import { DisputesService } from "@/src/services/disputes"

// How many failed_delivery events on the same order before we stop waiting
// on the buyer to notice and reach out, and instead auto-open a dispute so
// a moderator picks it up. 1 = escalate immediately on first failure, since
// "fast delivery" is the whole value prop and a stalled parcel with no
// owner is worse than an over-eager dispute a moderator can close in 30s.
const FAILED_DELIVERY_ESCALATION_THRESHOLD = 2

const ZLA_TO_ORDER_STATUS: Record<string, string> = {
  pending: "escrow_held", dropped_off: "dropped_off",
  picked_up_by_rider: "in_transit", in_transit: "in_transit",
  at_destination_agent: "at_destination_agent", out_for_delivery: "out_for_delivery",
  delivered: "delivered", failed_delivery: "delivery_failed",
  disputed: "disputed", returned: "returned",
}

export async function POST(req: NextRequest) {
  try {
    const rawBody   = await req.text()
    const signature = req.headers.get("x-zla-signature") ?? ""
    if (!ZamoraxLogicClient.verifyWebhookSignature(rawBody, signature))
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })

    const { event, data } = JSON.parse(rawBody)
    if (!event?.startsWith("shipment.")) return NextResponse.json({ received: true })

    const { shipmentId, externalOrderId, status, trackingCode, agentName, agentAddress, notes } = data
    if (!externalOrderId) return NextResponse.json({ received: true })

    const order = await AdminService.getDoc("orders", externalOrderId) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ received: true })

    const orderStatus  = ZLA_TO_ORDER_STATUS[status] ?? "in_transit"
    const timelineRaw  = (() => { try { return JSON.parse(String(order.zla_timeline ?? "[]")) } catch { return [] } })()
    const timelineEntry = { status, note: notes ?? `Shipment ${status.replace(/_/g, " ")}`, agentName: agentName ?? null, timestamp: new Date().toISOString(), source: "zamoraxlogic" }

    await AdminService.updateDoc("orders", externalOrderId, {
      status:           orderStatus,
      zla_shipment_id:  shipmentId ?? order.zla_shipment_id,
      zla_tracking_code: trackingCode ?? order.zla_tracking_code,
      zla_last_status:  status,
      zla_timeline:     JSON.stringify([...timelineRaw, timelineEntry]),
      ...(status === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
    })

    const BUYER_NOTIFY: Record<string, { title: string; body: string }> = {
      dropped_off:          { title: "📦 Parcel Picked Up", body: "The seller has dropped your parcel at the ZamoraxLogic agent. It's on its way!" },
      in_transit:           { title: "🚚 Parcel In Transit", body: "Your parcel is moving between agents and heading your way." },
      at_destination_agent: { title: "📍 Parcel Arrived Near You", body: `Your parcel is at a local agent${agentName ? `: ${agentName}` : ""}. Ready for collection or doorstep delivery.` },
      out_for_delivery:     { title: "🛵 Out for Delivery", body: "Your parcel is on the way to your address right now!" },
      delivered:            { title: "✅ Parcel Delivered!", body: "Your order has been delivered. Please confirm receipt on your order page." },
      failed_delivery:      { title: "⚠️ Delivery Failed", body: "We couldn't deliver your parcel. Please contact support to rearrange." },
    }

    const buyerId  = String(order.buyer_id  ?? order.buyerId  ?? "")
    const sellerId = String(order.seller_id ?? order.sellerId ?? "")

    if (BUYER_NOTIFY[status] && buyerId) {
      await AdminService.addDoc("notifications", {
        user_id: buyerId, type: "order_update",
        title: BUYER_NOTIFY[status].title, body: BUYER_NOTIFY[status].body,
        link: `/dashboard/buyer/orders/${externalOrderId}`, is_read: false,
      })
    }
    if (status === "delivered" && sellerId) {
      await AdminService.addDoc("notifications", {
        user_id: sellerId, type: "order_update", title: "✅ Order Delivered",
        body: "Your parcel has been delivered to the buyer. Escrow release timer has started.",
        link: `/dashboard/seller/orders/${externalOrderId}`, is_read: false,
      })
    }

    // Auto-escalate repeated delivery failures instead of leaving it on the
    // buyer to notice and contact support. Count failed_delivery entries
    // already logged in the timeline (including the one just appended) —
    // once past the threshold, open a dispute automatically so a moderator
    // picks it up, and let both sides know it's already been raised.
    if (status === "failed_delivery") {
      const failureCount = [...timelineRaw, timelineEntry]
        .filter((e: any) => e?.status === "failed_delivery").length

      if (failureCount >= FAILED_DELIVERY_ESCALATION_THRESHOLD && buyerId && sellerId) {
        const alreadyDisputed = String(order.status ?? "") === "disputed"
          || !!(order as any).auto_dispute_opened

        if (!alreadyDisputed) {
          try {
            const { id: disputeId } = await DisputesService.openDispute({
              orderId: externalOrderId,
              buyerId,
              sellerId,
              raisedBy: "buyer",
              reason: "item_not_received",
              description:
                `Auto-opened: ZamoraxLogic reported ${failureCount} failed delivery ` +
                `attempts for shipment ${shipmentId ?? "(unknown)"}` +
                (notes ? ` — latest note: ${notes}` : "") + ".",
            })

            await AdminService.updateDoc("orders", externalOrderId, {
              status: "disputed",
              auto_dispute_opened: true,
              auto_dispute_id: disputeId,
            })

            await AdminService.addDoc("notifications", {
              user_id: buyerId, type: "order_update",
              title: "⚠️ Delivery Issue — We've Opened a Case",
              body: "Repeated delivery attempts failed, so we've automatically opened a support case. A moderator will follow up shortly.",
              link: `/dashboard/buyer/returns`, is_read: false,
            })
            await AdminService.addDoc("notifications", {
              user_id: sellerId, type: "order_update",
              title: "⚠️ Delivery Failed Repeatedly",
              body: "ZamoraxLogic couldn't deliver this order after multiple attempts. A case has been opened automatically — no action needed from you yet.",
              link: `/dashboard/seller/orders/${externalOrderId}`, is_read: false,
            })
          } catch (disputeErr) {
            // Don't let dispute-creation failure break the webhook ack —
            // ZamoraxLogic will retry the event, and the buyer still got
            // the failed_delivery notification above either way.
            console.error("[zamoraxlogic webhook] auto-dispute failed:", disputeErr)
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}
