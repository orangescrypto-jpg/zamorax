// app/api/orders/cancel/route.ts
// Buyer cancels a pending order (before escrow is held).
// Works on both Vercel (CF D1 HTTP API) and Cloudflare Pages (native D1 binding).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })

    // Fetch the order
    const rows = await d1Query(
      `SELECT id, buyer_id, seller_id, status, item_title FROM orders WHERE id = ? LIMIT 1`,
      [orderId],
      nativeDB,
    )
    const order = (rows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Only the buyer can cancel their own order
    const buyerId = String(order.buyer_id ?? "")
    if (buyerId !== auth.user.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }

    // Only cancellable when still pending
    const status = String(order.status ?? "")
    if (status !== "pending") {
      return NextResponse.json(
        { error: `Cannot cancel an order with status "${status}". Only pending orders can be cancelled.` },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()

    await d1Query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = ?, cancelled_by = 'buyer', updated_at = ? WHERE id = ?`,
      [now, now, orderId],
      nativeDB,
    )

    // Notify the seller — non-fatal
    const sellerId = String(order.seller_id ?? "")
    if (sellerId) {
      try {
        const notifId = crypto.randomUUID()
        await d1Query(
          `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at, updated_at)
           VALUES (?, ?, 'system', ?, ?, ?, 0, ?, ?)`,
          [
            notifId,
            sellerId,
            "❌ Order Cancelled",
            `A buyer cancelled their order for "${order.item_title ?? "your listing"}".`,
            `/dashboard/seller/orders/${orderId}`,
            now,
            now,
          ],
          nativeDB,
        )
      } catch (notifErr) {
        console.warn("[cancel] notification insert failed (non-fatal):", notifErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[POST /api/orders/cancel]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
