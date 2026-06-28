// app/api/orders/cancel/route.ts
// Buyer can cancel a pending order (before escrow is held).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })

    const order = await AdminService.getDoc("orders", orderId) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Only the buyer can cancel their own order
    const buyerId = String(order.buyerId ?? order.buyer_id ?? "")
    if (buyerId !== auth.user.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }

    // Only cancellable when still pending (before admin confirms payment / escrow)
    const status = String(order.status ?? "")
    if (status !== "pending") {
      return NextResponse.json(
        { error: `Cannot cancel an order with status "${status}". Only pending orders can be cancelled.` },
        { status: 409 },
      )
    }

    await AdminService.updateDoc("orders", orderId, {
      status:      "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledBy: "buyer",
    })

    // Notify the seller
    const sellerId = String(order.sellerId ?? order.seller_id ?? "")
    if (sellerId) {
      try {
        await AdminService.addDoc("notifications", {
          user_id: sellerId,
          type:    "system",
          title:   "❌ Order Cancelled",
          body:    `A buyer cancelled their order for "${order.itemTitle ?? order.item_title ?? "your listing"}".`,
          link:    `/dashboard/seller/orders/${orderId}`,
          is_read: false,
        })
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[POST /api/orders/cancel]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
