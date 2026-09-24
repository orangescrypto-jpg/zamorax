export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<{ id: string }>; env?: { DB?: unknown } }

const STAFF_ROLES = new Set(["admin", "moderator"])

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const { id: orderId } = await context.params
  const nativeDB = (context as any)?.env?.DB

  try {
    const rows = await d1Query(
      `SELECT o.id, o.buyer_id, o.seller_id, o.status, o.delivery_method, o.listing_id,
              (SELECT is_official FROM users WHERE users.uid = o.seller_id) AS seller_is_official,
              l.is_zamorax_pick
         FROM orders o
         LEFT JOIN listings l ON l.id = o.listing_id
        WHERE o.id = ?
        LIMIT 1`,
      [orderId],
      nativeDB,
    )
    const order = (rows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const buyerId = String(order.buyer_id ?? "")
    const sellerId = String(order.seller_id ?? "")
    const status = String(order.status ?? "")
    const deliveryMethod = String(order.delivery_method ?? "")
    const isOfficial = !!order.seller_is_official || !!order.is_zamorax_pick

    const isBuyer = auth.uid === buyerId
    const isSeller = auth.uid === sellerId
    const isStaff = auth.role ? STAFF_ROLES.has(auth.role) : false

    if (!isBuyer && !isSeller && !isStaff) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }

    // ── Zamorax Direct orders: Zamorax staff see the buyer's contact
    // only, once escrow is held. The buyer never sees a phone number —
    // Zamorax Direct support chat is used instead. ──────────────────
    if (isOfficial) {
      if (!isStaff) {
        return NextResponse.json(
          { error: "This is a Zamorax Direct order. Use Contact Support from your order page." },
          { status: 403 },
        )
      }
      if (status !== "escrow_held" && status !== "shipped" && status !== "delivered") {
        return NextResponse.json(
          { error: `Contact is not available yet for an order with status "${status}".` },
          { status: 409 },
        )
      }

      const userRows = await d1Query(
        "SELECT phone FROM users WHERE uid = ? LIMIT 1",
        [buyerId],
        nativeDB,
      )
      const phone = (userRows?.results?.[0] as { phone?: string } | undefined)?.phone ?? null

      try {
        await d1Query(
          `INSERT INTO contact_reveals (id, order_id, revealed_to_user_id, revealed_user_id, order_status_at_reveal, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          [crypto.randomUUID(), orderId, auth.uid, buyerId, status],
          nativeDB,
        )
      } catch { /* non-fatal */ }

      return NextResponse.json({ phone, revealedRole: "buyer" })
    }

    // ── Third-party orders ──────────────────────────────────────────
    const isDelivery = deliveryMethod === "zamorax_logistics" || deliveryMethod === "fbz"
    const isMeetup = deliveryMethod === "meetup" || !deliveryMethod

    let allowed = false
    let targetUserId: string | null = null

    if (isMeetup) {
      // Mutual reveal once escrow is held — both parties need to
      // coordinate the meetup itself.
      if (status === "escrow_held" || status === "shipped" || status === "delivered" || status === "completed") {
        if (isBuyer) { allowed = true; targetUserId = sellerId }
        else if (isSeller) { allowed = true; targetUserId = buyerId }
        else if (isStaff) { allowed = true; targetUserId = null }
      }
    } else if (isDelivery) {
      // Buyer sees the seller's number only, once the order has shipped.
      // The courier/logistics is the intermediary, not the seller
      // directly, so the seller never needs the buyer's number here.
      if (status === "shipped" || status === "delivered" || status === "completed") {
        if (isBuyer) { allowed = true; targetUserId = sellerId }
        else if (isStaff) { allowed = true; targetUserId = null }
      }
    }

    if (!allowed) {
      return NextResponse.json(
        { error: `Contact is not available yet for this order (status "${status}").` },
        { status: 403 },
      )
    }

    if (isStaff && !targetUserId) {
      // Staff viewing a third-party order for moderation — show both.
      const bothRows = await d1Query(
        "SELECT uid, phone FROM users WHERE uid IN (?, ?)",
        [buyerId, sellerId],
        nativeDB,
      )
      const results = (bothRows?.results ?? []) as Array<{ uid: string; phone?: string }>
      const buyerPhone = results.find(r => r.uid === buyerId)?.phone ?? null
      const sellerPhone = results.find(r => r.uid === sellerId)?.phone ?? null
      return NextResponse.json({ buyerPhone, sellerPhone })
    }

    const userRows = await d1Query(
      "SELECT phone FROM users WHERE uid = ? LIMIT 1",
      [targetUserId],
      nativeDB,
    )
    const phone = (userRows?.results?.[0] as { phone?: string } | undefined)?.phone ?? null

    try {
      await d1Query(
        `INSERT INTO contact_reveals (id, order_id, revealed_to_user_id, revealed_user_id, order_status_at_reveal, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [crypto.randomUUID(), orderId, auth.uid, targetUserId, status],
        nativeDB,
      )
    } catch { /* non-fatal */ }

    return NextResponse.json({ phone, revealedRole: isBuyer ? "seller" : "buyer" })
  } catch (err) {
    console.error("[api/orders/reveal-contact] failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
