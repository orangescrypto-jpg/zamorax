// app/api/disputes/resolve/route.ts
// Admin-only: resolves a dispute and triggers actual escrow settlement.
// Guards:
//   - Caller must have role = "admin"
//   - Dispute must exist and not already be resolved
//   - Split resolution requires refundPercent 1–99
// Side-effects:
//   - Calls settleEscrow() to credit seller wallet and/or log buyer refund
//   - Updates dispute.status → "resolved" with full audit trail
//   - Optionally adds to public ledger
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"
import { settleEscrow } from "@/src/services/providers/cloudflare/disputes"
import { DISPUTE_STATUS } from "@/constants/status"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireAdmin(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const {
      disputeId,
      orderId,
      resolution,
      addToPublicLedger = false,
      refundPercent,
    } = await req.json() as {
      disputeId: string
      orderId: string
      resolution: "refunded" | "released" | "split"
      addToPublicLedger?: boolean
      refundPercent?: number | null
    }

    // ── Input validation ──────────────────────────────────────────────────────
    if (!disputeId || !orderId || !resolution) {
      return NextResponse.json({ error: "disputeId, orderId, and resolution are required" }, { status: 400 })
    }
    if (!["refunded", "released", "split"].includes(resolution)) {
      return NextResponse.json({ error: "resolution must be refunded, released, or split" }, { status: 400 })
    }
    if (resolution === "split") {
      const pct = Number(refundPercent)
      if (!refundPercent || pct < 1 || pct > 99) {
        return NextResponse.json(
          { error: "Split resolution requires refundPercent between 1 and 99" },
          { status: 400 },
        )
      }
    }

    // ── Load dispute ──────────────────────────────────────────────────────────
    const dispute = await AdminService.getDoc("disputes", disputeId) as Record<string, unknown> | null
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 })
    }

    // ── Guard: prevent double-resolution ─────────────────────────────────────
    const currentStatus = String(dispute.status ?? "")
    if (currentStatus === DISPUTE_STATUS.RESOLVED || currentStatus === DISPUTE_STATUS.AUTO_RESOLVED) {
      return NextResponse.json({ error: "Dispute is already resolved" }, { status: 409 })
    }

    const now = new Date().toISOString()
    const pct = resolution === "split" ? Number(refundPercent) : undefined

    // ── Settle escrow: move money FIRST ──────────────────────────────────────
    // If this throws the dispute status is NOT updated — keeps state consistent.
    await settleEscrow(orderId, resolution, pct)

    // ── Map resolution → dispute verdict ──────────────────────────────────────
    const verdictMap: Record<string, string> = {
      released: "release_seller",
      refunded: "refund_buyer",
      split:    "partial_refund",
    }

    // ── Mark dispute as resolved ──────────────────────────────────────────────
    await AdminService.updateDoc("disputes", disputeId, {
      status:            DISPUTE_STATUS.RESOLVED,
      verdict:           verdictMap[resolution],
      resolution,
      refund_percent:    pct ?? null,
      resolved_by:       auth.uid,
      resolved_at:       now,
      is_public_ledger:  addToPublicLedger ? 1 : 0,
      public_summary:    addToPublicLedger
        ? `Dispute resolved by admin (${resolution})${pct ? ` — ${pct}% refunded to buyer` : ""}. ${new Date().toLocaleDateString("en-NG")}`
        : null,
      updated_at:        now,
    })

    // ── Notify both parties of outcome ────────────────────────────────────────
    const buyerId  = String(dispute.buyer_id  ?? dispute.buyerId  ?? "")
    const sellerId = String(dispute.seller_id ?? dispute.sellerId ?? "")

    const buyerMsg = resolution === "released"
      ? "The admin has reviewed the evidence and released funds to the seller. The dispute is closed."
      : resolution === "refunded"
      ? "The admin has reviewed the evidence and approved a full refund. Expect your refund within 2–5 working days."
      : `The admin has split the payout. You will receive a ${pct}% refund. Bank transfer in 2–5 working days.`

    const sellerMsg = resolution === "released"
      ? "The admin has reviewed the evidence and released your escrow funds. They have been credited to your wallet."
      : resolution === "refunded"
      ? "The admin has reviewed the evidence and issued a refund to the buyer. No funds will be credited to your wallet for this order."
      : `The admin has split the payout. ${100 - (pct ?? 50)}% of the escrow has been credited to your wallet.`

    const notifications = [
      buyerId  && AdminService.addDoc("notifications", { user_id: buyerId,  type: "dispute_resolved", title: "⚖️ Dispute Resolved", body: buyerMsg,  dispute_id: disputeId, is_read: false, created_at: now }),
      sellerId && AdminService.addDoc("notifications", { user_id: sellerId, type: "dispute_resolved", title: "⚖️ Dispute Resolved", body: sellerMsg, dispute_id: disputeId, is_read: false, created_at: now }),
    ].filter(Boolean)

    await Promise.all(notifications)

    return NextResponse.json({ success: true, resolution, refundPercent: pct ?? null })
  } catch (err: any) {
    console.error("[disputes/resolve]", err)
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 })
  }
}
