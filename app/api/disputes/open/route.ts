// app/api/disputes/open/route.ts
// Server-side dispute creation with auth enforcement:
//   - Caller must be authenticated
//   - Caller must be the buyer of the referenced order
//   - Order must exist and be in a disputable state (paid/shipped/delivered/inspecting)
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"
import { ORDER_STATUS } from "@/constants/status"

const DISPUTABLE_STATUSES = new Set<string>([
  ORDER_STATUS.PAID,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.INSPECTING,
  ORDER_STATUS.DISPUTED,
])

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireAuth(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const { orderId, buyerId, sellerId, raisedBy, reason, description, evidence = [] } =
      await req.json() as {
        orderId: string
        buyerId: string
        sellerId: string
        raisedBy: "buyer" | "seller"
        reason: string
        description: string
        evidence?: string[]
      }

    // ── Validate required fields ─────────────────────────────────────────────
    if (!orderId || !sellerId || !reason || !description?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (description.trim().length < 20) {
      return NextResponse.json({ error: "Description must be at least 20 characters" }, { status: 400 })
    }

    // ── Authorisation: only the actual buyer of the order may open a dispute ─
    const order = await AdminService.getDoc("orders", orderId) as Record<string, unknown> | null
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const orderBuyerId = String(order.buyer_id ?? order.buyerId ?? "")
    if (orderBuyerId !== auth.uid) {
      return NextResponse.json({ error: "Only the buyer of this order can open a dispute" }, { status: 403 })
    }

    // ── Guard: order must be in a disputable state ───────────────────────────
    const orderStatus = String(order.status ?? "")
    if (!DISPUTABLE_STATUSES.has(orderStatus)) {
      return NextResponse.json(
        { error: `Order status "${orderStatus}" cannot be disputed. Order must be paid, shipped, delivered, or in inspection.` },
        { status: 422 },
      )
    }

    // ── Guard: no duplicate open dispute on the same order ───────────────────
    if (order.dispute_id || order.disputeId) {
      return NextResponse.json({ error: "A dispute already exists for this order" }, { status: 409 })
    }

    const now = new Date().toISOString()

    // ── Create dispute record ────────────────────────────────────────────────
    const ref = await AdminService.addDoc("disputes", {
      order_id:    orderId,
      buyer_id:    auth.uid,
      seller_id:   sellerId,
      raised_by:   raisedBy ?? "buyer",
      reason,
      description: description.trim(),
      evidence:    evidence.length ? JSON.stringify(evidence) : null,
      status:      "open",
      created_at:  now,
      updated_at:  now,
    })

    // ── Mark order as disputed + attach dispute_id ───────────────────────────
    await AdminService.updateDoc("orders", orderId, {
      status:     ORDER_STATUS.DISPUTED,
      dispute_id: ref.id,
      updated_at: now,
    })

    // ── Notify seller ─────────────────────────────────────────────────────────
    await AdminService.addDoc("notifications", {
      user_id:    sellerId,
      type:       "dispute_opened",
      title:      "A Dispute Has Been Filed",
      body:       `A buyer filed a dispute for order #${orderId.slice(-6).toUpperCase()}. Reason: ${reason}. Respond within 48 hours.`,
      order_id:   orderId,
      dispute_id: ref.id,
      is_read:    false,
      created_at: now,
    })

    return NextResponse.json({ id: ref.id }, { status: 201 })
  } catch (err: any) {
    console.error("[disputes/open]", err)
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 })
  }
}
