// app/api/disputes/respond/route.ts
// Seller submits a response (text + optional evidence images) to a dispute.
// Guards:
//   - Caller must be authenticated
//   - Caller must be the seller on the referenced dispute
//   - Dispute must still be open or investigating (not already resolved)
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireAuth(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const { disputeId, response, sellerEvidence = [] } = await req.json() as {
      disputeId: string
      response: string
      sellerEvidence?: string[]
    }

    if (!disputeId || !response?.trim()) {
      return NextResponse.json({ error: "disputeId and response are required" }, { status: 400 })
    }

    // ── Load dispute ──────────────────────────────────────────────────────────
    const dispute = await AdminService.getDoc("disputes", disputeId) as Record<string, unknown> | null
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 })
    }

    // ── Authorisation: only the seller of this dispute may respond ────────────
    const disputeSellerId = String(dispute.seller_id ?? dispute.sellerId ?? "")
    if (disputeSellerId !== auth.uid) {
      return NextResponse.json({ error: "Only the seller of this dispute can submit a response" }, { status: 403 })
    }

    // ── Guard: cannot respond to an already-resolved dispute ─────────────────
    const currentStatus = String(dispute.status ?? "")
    if (currentStatus === "resolved" || currentStatus === "auto_resolved") {
      return NextResponse.json({ error: "Cannot respond to a resolved dispute" }, { status: 422 })
    }

    const now = new Date().toISOString()

    await AdminService.updateDoc("disputes", disputeId, {
      seller_response:     response.trim(),
      seller_evidence:     sellerEvidence.length ? JSON.stringify(sellerEvidence) : null,
      seller_responded_at: now,
      status:              "investigating",
      updated_at:          now,
    })

    // ── Notify buyer that seller responded ────────────────────────────────────
    const buyerId = String(dispute.buyer_id ?? dispute.buyerId ?? "")
    if (buyerId) {
      await AdminService.addDoc("notifications", {
        user_id:    buyerId,
        type:       "dispute_response",
        title:      "Seller Responded to Your Dispute",
        body:       "The seller has submitted a response to your dispute. Our team is now reviewing.",
        dispute_id: disputeId,
        is_read:    false,
        created_at: now,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[disputes/respond]", err)
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 })
  }
}
