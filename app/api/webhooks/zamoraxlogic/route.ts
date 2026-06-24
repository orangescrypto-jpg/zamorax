// app/api/webhooks/zamoraxlogic/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"

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

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: "Webhook error" }, { status: 500 })
  }
}
