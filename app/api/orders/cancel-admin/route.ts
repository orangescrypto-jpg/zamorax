// app/api/orders/cancel-admin/route.ts
// Admin/moderator cancels an order outright, at ANY stage — distinct from
// /api/orders/cancel (buyer's own self-serve cancel, which only works
// pre-escrow). Like that route, admin cancel PERMANENTLY DELETES the order
// row from the database once rollback/notifications are done — it is NOT
// kept around for audit purposes. This is TERMINAL and NOT retry-able
// (unlike /api/payment/reject, which keeps the order alive for a retry).
//   - rolls back any stock that was decremented when the order was created
//   - emails + notifies BOTH buyer and seller with the reason BEFORE deletion,
//     since the order row (item title, amounts, etc.) is needed to compose them
//   - admin is BCC'd automatically via the shared adminNotifyEmails config
//   - the order row and any linked pending_payments row are deleted last
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { AdminService } from "@/src/services/admin"
import { Emails } from "@/src/services/email"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function ngn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

// Orders that have already released funds to the seller shouldn't be
// silently deleted by this route — those need the proper refund/dispute
// path instead, since money has already moved.
const NON_CANCELLABLE_STATUSES = new Set(["completed", "cancelled"])

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireModerator(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const { orderId, reason } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "A cancellation reason is required" }, { status: 400 })
    }
    const trimmedReason = String(reason).trim()

    const rows = await d1Query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId], nativeDB)
    const order = (rows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const status = String(order.status ?? "")
    if (NON_CANCELLABLE_STATUSES.has(status)) {
      return NextResponse.json(
        { error: `Cannot cancel an order with status "${status}".` },
        { status: 409 },
      )
    }

    // ── Roll back any stock reserved when the order was created ────────
    // Non-fatal: if stock restoration fails for a line item, cancellation
    // still proceeds — an admin can manually fix stock counts, but a stuck
    // cancellation would be worse (buyer/seller left in limbo).
    try {
      const lineItems = (() => {
        try { return JSON.parse(String(order.line_items ?? "[]")) } catch { return [] }
      })()
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        for (const item of lineItems) {
          if (!item?.listingId || !item?.qty) continue
          await d1Query(
            `UPDATE listings SET stock_qty = stock_qty + ? WHERE id = ? AND stock_qty IS NOT NULL`,
            [item.qty, item.listingId],
            nativeDB,
          )
        }
      } else if (order.listing_id) {
        // Single-item order (Buy Now) — restore 1 unit if the listing tracks stock.
        await d1Query(
          `UPDATE listings SET stock_qty = stock_qty + 1 WHERE id = ? AND stock_qty IS NOT NULL`,
          [order.listing_id],
          nativeDB,
        )
      }
    } catch (stockErr) {
      console.error("[orders/cancel-admin] stock rollback failed (non-fatal):", stockErr)
    }

    const buyerId   = String(order.buyer_id ?? "")
    const sellerId  = String(order.seller_id ?? "")
    const itemTitle = String(order.item_title ?? "your order")
    const amount    = Number(order.total_amount ?? 0)

    // ── Buyer notification + email — sent BEFORE delete, using order data ──
    if (buyerId) {
      try {
        await AdminService.addDoc("notifications", {
          user_id: buyerId,
          type:    "system",
          title:   "🚫 Order Cancelled",
          body:    `Your order for "${itemTitle}" has been cancelled by Zamorax. Reason: ${trimmedReason}.`,
          link:    "/dashboard/buyer/orders",
          is_read: false,
        })
      } catch (err) {
        console.error("[orders/cancel-admin] buyer notification failed (non-fatal):", err)
      }
      try {
        const buyer = await AdminService.getDoc("users", buyerId) as Record<string, unknown> | null
        const buyerEmail = String(buyer?.email ?? "")
        if (buyerEmail) {
          Emails.orderCancelledAdmin(buyerEmail, {
            recipientName: String(buyer?.fullName ?? "there"),
            role:          "buyer",
            itemTitle,
            orderId,
            amount:        ngn(amount),
            reason:        trimmedReason,
          }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
        }
      } catch (err) {
        console.error("[orders/cancel-admin] buyer email failed (non-fatal):", err)
      }
    }

    // ── Seller notification + email — sent BEFORE delete, using order data ─
    if (sellerId) {
      try {
        await AdminService.addDoc("notifications", {
          user_id: sellerId,
          type:    "system",
          title:   "🚫 Order Cancelled",
          body:    `An order for "${itemTitle}" has been cancelled by Zamorax. Reason: ${trimmedReason}.`,
          link:    "/dashboard/seller/orders",
          is_read: false,
        })
      } catch (err) {
        console.error("[orders/cancel-admin] seller notification failed (non-fatal):", err)
      }
      try {
        const seller = await AdminService.getDoc("users", sellerId) as Record<string, unknown> | null
        const sellerEmail = String(seller?.email ?? "")
        if (sellerEmail) {
          Emails.orderCancelledAdmin(sellerEmail, {
            recipientName: String(seller?.fullName ?? "there"),
            role:          "seller",
            itemTitle,
            orderId,
            amount:        ngn(amount),
            reason:        trimmedReason,
          }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
        }
      } catch (err) {
        console.error("[orders/cancel-admin] seller email failed (non-fatal):", err)
      }
    }

    // ── Permanently delete the order row, matching buyer self-cancel ───────
    // Everything the emails/notifications above needed from `order` has
    // already been read and sent, so it's safe to delete now.
    await d1Query(`DELETE FROM orders WHERE id = ?`, [orderId], nativeDB)

    // Also delete any pending_payments row tied to this order so it
    // disappears from the admin payments page too.
    try {
      await d1Query(
        `DELETE FROM pending_payments WHERE metadata LIKE ?`,
        [`%"orderId":"${orderId}"%`],
        nativeDB,
      )
    } catch (cleanupErr) {
      console.warn("[orders/cancel-admin] pending_payments cleanup failed (non-fatal):", cleanupErr)
    }

    return NextResponse.json({ success: true, deleted: true })
  } catch (err: any) {
    console.error("[POST /api/orders/cancel-admin]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
