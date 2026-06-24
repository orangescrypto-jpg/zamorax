// app/api/zla/delivery-confirmed/route.ts
// NEW FILE — Add this to Zamorax marketplace
// Receives delivery confirmation webhooks from ZamoraxLogic.com
// Triggers escrow release when a ZLA delivery is confirmed

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services"
import { serverTimestamp } from "@/src/services"
import { ZamoraxLogicClient } from "@/lib/zamoraxlogic"

export async function POST(request: NextRequest) {
  try {
    const body      = await request.text()
    const signature = request.headers.get("x-zamoraxlogic-signature") || ""

    // Step 1 — Verify signature
    const isValid = ZamoraxLogicClient.verifyWebhookSignature(body, signature)
    if (!isValid) {
      console.error("[ZLA Webhook] Invalid signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(body)
    const { event, externalOrderId, trackingCode, deliveredAt } = payload

    // Step 2 — Handle each event
    switch (event) {

      case "shipment.delivered": {
        // Update order status
        await AdminService.updateDoc("orders", externalOrderId, {
          status:      "delivered",
          deliveredAt: deliveredAt || serverTimestamp(),
          trackingCode,
          updatedAt:   serverTimestamp(),
        })

        // Fetch order to get buyerId
        const order = await AdminService.getDoc("orders", externalOrderId)
        if (order) {
          // Notify buyer to confirm receipt
          await AdminService.addDoc("notifications", {
            userId:    order.buyerId,
            type:      "system",
            title:     "📦 Your item has arrived!",
            body:      `"${order.itemTitle}" has been delivered. Confirm receipt to release payment to seller.`,
            link:      `/dashboard/buyer/orders/${externalOrderId}`,
            read:      false,
            createdAt: serverTimestamp(),
          })
        }
        break
      }

      case "shipment.in_transit": {
        await AdminService.updateDoc("orders", externalOrderId, {
          zlaStatus:   "in_transit",
          trackingCode,
          updatedAt:   serverTimestamp(),
        })
        break
      }

      case "shipment.at_destination": {
        await AdminService.updateDoc("orders", externalOrderId, {
          zlaStatus:   "at_destination_agent",
          trackingCode,
          updatedAt:   serverTimestamp(),
        })

        const order = await AdminService.getDoc("orders", externalOrderId)
        if (order) {
          await AdminService.addDoc("notifications", {
            userId:    order.buyerId,
            type:      "system",
            title:     "📍 Your parcel is ready for pickup!",
            body:      `"${order.itemTitle}" has arrived at the destination agent. Tracking: ${trackingCode}`,
            link:      `/dashboard/buyer/orders/${externalOrderId}`,
            read:      false,
            createdAt: serverTimestamp(),
          })
        }
        break
      }

      case "shipment.disputed": {
        await AdminService.updateDoc("orders", externalOrderId, {
          zlaStatus:      "disputed",
          zlaDisputeNote: payload.reason || "",
          updatedAt:      serverTimestamp(),
        })
        break
      }

      case "shipment.failed_delivery": {
        await AdminService.updateDoc("orders", externalOrderId, {
          zlaStatus: "failed_delivery",
          updatedAt: serverTimestamp(),
        })
        break
      }

      case "shipment.returned": {
        await AdminService.updateDoc("orders", externalOrderId, {
          zlaStatus: "returned",
          updatedAt: serverTimestamp(),
        })
        break
      }

      default:
        // Unknown event — log and return 200 so ZamoraxLogic doesn't retry
        console.log(`[ZLA Webhook] Unknown event: ${event}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error("[ZLA Webhook] Error:", error.message)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
