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
import { requireModerator, requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { AdminService } from "@/src/services/admin"
import { Emails } from "@/src/services/email"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function ngn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

// Orders that have already released funds to the seller shouldn't be
// silently deleted by this route WITHOUT clawing that money back first —
// pass forceDelete: true to delete them anyway; the route will debit the
// seller's wallet and attempt a Paystack refund before removing the row,
// same reversal logic as /api/orders/reverse-payment, just followed by
// an actual delete instead of leaving a "refunded" row behind.
const NON_CANCELLABLE_STATUSES = new Set(["completed", "cancelled", "refunded"])

async function refundPaystack(reference: string, amountKobo?: number) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey || !reference) return { ok: false, error: "not attempted" }
  try {
    const res = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ transaction: reference, ...(amountKobo ? { amount: amountKobo } : {}) }),
    })
    const data = await res.json()
    if (!res.ok || !data.status) return { ok: false, error: data.message || "Paystack refund failed" }
    return { ok: true }
  } catch (err: any) {
    return { ok: false, error: err.message || "Paystack refund request failed" }
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const { forceDelete } = await req.clone().json().catch(() => ({ forceDelete: false }))
  // forceDelete on an already-paid order claws back real money (seller
  // wallet debit + Paystack refund) — that needs full admin, not just
  // moderator. A plain cancel of a not-yet-paid order stays moderator-level.
  const auth = forceDelete ? await requireAdmin(req, nativeDB) : await requireModerator(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const { orderId, reason, forceDelete } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "A cancellation reason is required" }, { status: 400 })
    }
    const trimmedReason = String(reason).trim()

    const rows = await d1Query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId], nativeDB)
    const order = (rows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const status = String(order.status ?? "")
    if (NON_CANCELLABLE_STATUSES.has(status) && !forceDelete) {
      return NextResponse.json(
        {
          error: `Cannot cancel an order with status "${status}" — money has already moved. Pass forceDelete to delete it anyway (this claws back the seller's payout and attempts a Paystack refund first).`,
        },
        { status: 409 },
      )
    }

    // ── If money already moved, claw it back BEFORE deleting ───────────
    let walletReversed = false
    let paystackRefund: { attempted: boolean; ok: boolean; error?: string } = { attempted: false, ok: false }
    const wasCompleted = status === "completed" || String(order.escrow_status ?? "") === "released_to_seller"
    const sellerIdForReversal = String(order.seller_id ?? "")
    const payoutAmount = Number(order.seller_payout ?? 0)

    if (forceDelete && wasCompleted && sellerIdForReversal && payoutAmount > 0) {
      const now = new Date().toISOString()
      const wallet = await AdminService.getDoc("seller_wallets", sellerIdForReversal).catch(() => null) as Record<string, unknown> | null
      const bal = Number((wallet as any)?.balance ?? 0)
      const newBal = bal - payoutAmount
      if (wallet) {
        await d1Query(`UPDATE seller_wallets SET balance = ?, updated_at = ? WHERE user_id = ?`, [newBal, now, sellerIdForReversal], nativeDB)
      } else {
        await d1Query(
          `INSERT INTO seller_wallets (id, user_id, balance, total_earned, pending_balance, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), sellerIdForReversal, newBal, 0, 0, now],
          nativeDB,
        )
      }
      await d1Query(
        `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, gross_amount, description, order_id, reference, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(), sellerIdForReversal, "debit", -payoutAmount, newBal,
          Number(order.total_amount ?? 0), `Order deleted by admin — order #${String(orderId).slice(0, 8).toUpperCase()}: ${trimmedReason}`,
          orderId, String(order.payment_reference ?? ""), "completed", now,
        ],
        nativeDB,
      )
      walletReversed = true
    }
    if (forceDelete && String(order.payment_provider ?? "") === "paystack" && order.payment_reference) {
      paystackRefund.attempted = true
      const result = await refundPaystack(String(order.payment_reference), Number(order.total_amount ?? 0) || undefined)
      paystackRefund.ok = result.ok
      if (!result.ok) paystackRefund.error = result.error
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

    return NextResponse.json({ success: true, deleted: true, walletReversed, paystackRefund })
  } catch (err: any) {
    console.error("[POST /api/orders/cancel-admin]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
