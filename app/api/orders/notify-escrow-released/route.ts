// app/api/orders/notify-escrow-released/route.ts
// Called by the buyer's order page right after OrdersService.releaseEscrow()
// succeeds client-side. The release itself (order update, wallet credit,
// notification) already happens client-side via the D1 proxy — this route
// exists purely to send the "Escrow Released" email server-side, since the
// email endpoint's internal secret must never be exposed to the browser.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { notifyEscrowReleased } from "@/src/services/notifyEscrowReleased"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })

    const rows = await d1Query(`SELECT * FROM orders WHERE id = ? LIMIT 1`, [orderId], nativeDB)
    const order = (rows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Only the buyer on this order can trigger the notification, and only
    // once escrow has actually been marked released — prevents anyone
    // spamming a seller's inbox for an order that hasn't been paid out.
    const buyerId = String(order.buyer_id ?? "")
    if (buyerId !== auth.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }
    const escrowStatus = String(order.escrow_status ?? order.escrowStatus ?? "")
    if (escrowStatus !== "released_to_seller") {
      return NextResponse.json({ error: "Escrow has not been released for this order" }, { status: 409 })
    }

    await notifyEscrowReleased(order)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[POST /api/orders/notify-escrow-released]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
