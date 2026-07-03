// src/services/providers/cloudflare/disputes.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import { notifyEscrowReleased } from "@/src/services/notifyEscrowReleased"
import type { IDisputesService } from "@/src/services/disputes"
import type { Dispute, PaginatedResult } from "@/src/types"
import { DISPUTE_STATUS, ESCROW_STATUS, ORDER_STATUS, TX_TYPE } from "@/constants/status"

const PAGE_SIZE = 20

// ── Row mapper ────────────────────────────────────────────────────────────────
function mapRow(row: Record<string, unknown>): Dispute {
  return {
    id:                String(row.id),
    orderId:           String(row.order_id        ?? row.orderId        ?? ""),
    buyerId:           String(row.buyer_id         ?? row.buyerId         ?? ""),
    sellerId:          String(row.seller_id        ?? row.sellerId        ?? ""),
    raisedBy:          (String(row.raised_by       ?? row.raisedBy        ?? "buyer")) as "buyer" | "seller",
    reason:            String(row.reason            ?? "") as Dispute["reason"],
    description:       String(row.description      ?? ""),
    evidence:          row.evidence ? JSON.parse(String(row.evidence)) : [],
    sellerEvidence:    row.seller_evidence ? JSON.parse(String(row.seller_evidence)) : [],
    status:            String(row.status            ?? "open"),
    verdict:           row.verdict                 ? String(row.verdict) as Dispute["verdict"] : undefined,
    refundPercent:     row.refund_percent != null  ? Number(row.refund_percent) : undefined,
    sellerResponse:    row.seller_response         ? String(row.seller_response)          : undefined,
    sellerRespondedAt: row.seller_responded_at     ? String(row.seller_responded_at)      : undefined,
    moderatorId:       row.moderator_id            ? String(row.moderator_id)             : undefined,
    moderatorNotes:    row.moderator_notes         ? String(row.moderator_notes)          : undefined,
    autoResolved:      row.auto_resolved           ? Boolean(row.auto_resolved)           : undefined,
    autoResolvedAt:    row.auto_resolved_at        ? String(row.auto_resolved_at)         : undefined,
    autoResolvedBy:    row.auto_resolved_by        ? String(row.auto_resolved_by)         : undefined,
    autoResolvedNotes: row.auto_resolved_notes     ? String(row.auto_resolved_notes)      : undefined,
    resolvedAt:        row.resolved_at             ? String(row.resolved_at)              : undefined,
    createdAt:         String(row.created_at       ?? new Date().toISOString()),
    updatedAt:         String(row.updated_at       ?? new Date().toISOString()),
  }
}

// ── Escrow/wallet settlement helper ──────────────────────────────────────────
// Called from resolveDispute() to actually move money.
// resolution:
//   "released"  → full sellerPayout goes to seller wallet
//   "refunded"  → full totalAmount is marked refunded to buyer (no wallet credit; refund handled by payment provider or admin)
//   "split"     → refundPercent% refunded to buyer, remainder credited to seller wallet
async function settleEscrow(
  orderId: string,
  resolution: "refunded" | "released" | "split",
  refundPercent?: number,
): Promise<void> {
  // ── 1. Load order ──────────────────────────────────────────────────────────
  const orderRow = await AdminService.getDoc("orders", orderId) as Record<string, unknown> | null
  if (!orderRow) throw new Error(`settleEscrow: order ${orderId} not found`)

  const sellerId      = String(orderRow.seller_id  ?? orderRow.sellerId  ?? "")
  const buyerId       = String(orderRow.buyer_id   ?? orderRow.buyerId   ?? "")
  const totalAmountKobo = Number(orderRow.total_amount ?? orderRow.totalAmount ?? 0)
  const sellerPayoutKobo = Number(orderRow.seller_payout ?? orderRow.sellerPayout ?? 0)
  const now = new Date().toISOString()

  // ── 2. Determine escrow outcome ───────────────────────────────────────────
  let escrowStatus: string
  let sellerCreditKobo = 0
  let buyerRefundKobo  = 0
  let orderStatus: string

  if (resolution === "released") {
    // Seller wins — full payout credited to seller wallet
    escrowStatus     = ESCROW_STATUS.RELEASED_TO_SELLER
    sellerCreditKobo = sellerPayoutKobo || totalAmountKobo
    orderStatus      = ORDER_STATUS.COMPLETED

  } else if (resolution === "refunded") {
    // Buyer wins — full refund; no wallet credit for seller
    escrowStatus    = ESCROW_STATUS.REFUNDED_TO_BUYER
    buyerRefundKobo = totalAmountKobo
    orderStatus     = ORDER_STATUS.REFUNDED

  } else {
    // Split — partial refund to buyer, remainder to seller
    const pct = Math.max(1, Math.min(99, refundPercent ?? 50))
    buyerRefundKobo  = Math.round(totalAmountKobo * (pct / 100))
    sellerCreditKobo = Math.max(0, totalAmountKobo - buyerRefundKobo)
    escrowStatus     = ESCROW_STATUS.PARTIAL_REFUND
    orderStatus      = ORDER_STATUS.PARTIAL_REFUND
  }

  // ── 3. Credit seller wallet (if any amount due) ───────────────────────────
  if (sellerCreditKobo > 0 && sellerId) {
    const walletRow = await AdminService.getDoc("seller_wallets", sellerId) as Record<string, unknown> | null
    const currentBal     = Number(walletRow?.balance          ?? 0)
    const currentEarned  = Number(walletRow?.total_earned     ?? walletRow?.totalEarned    ?? 0)
    const currentPending = Number(walletRow?.pending_balance  ?? walletRow?.pendingBalance ?? 0)

    await AdminService.setDoc("seller_wallets", sellerId, {
      balance:         currentBal     + sellerCreditKobo,
      total_earned:    currentEarned  + sellerCreditKobo,
      pending_balance: Math.max(0, currentPending - sellerCreditKobo),
      updated_at:      now,
    }, { merge: true })

    await AdminService.addDoc("wallet_transactions", {
      user_id:      sellerId,
      type:         TX_TYPE.CREDIT,
      amount:       sellerCreditKobo,
      balance_after: currentBal + sellerCreditKobo,
      description:  resolution === "split"
        ? `Dispute split payout — ₦${(sellerCreditKobo / 100).toLocaleString("en-NG")} credited (${100 - (refundPercent ?? 50)}% of escrow)`
        : `Escrow released via dispute — ₦${(sellerCreditKobo / 100).toLocaleString("en-NG")} credited`,
      order_id:     orderId,
      reference:    `dispute-release-${orderId}`,
      status:       "completed",
      created_at:   now,
    })

    await AdminService.addDoc("notifications", {
      user_id: sellerId,
      type:    "wallet_credit",
      title:   "💸 Dispute Settled — Funds Released",
      body:    `₦${(sellerCreditKobo / 100).toLocaleString("en-NG")} has been credited to your wallet from order #${orderId.slice(-6).toUpperCase()}.`,
      link:    "/dashboard/seller/wallet",
      is_read: false,
      created_at: now,
    })
  }

  // ── 4. Log buyer refund (for reconciliation / manual bank transfer record) ─
  if (buyerRefundKobo > 0 && buyerId) {
    await AdminService.addDoc("refund_records", {
      user_id:      buyerId,
      order_id:     orderId,
      amount:       buyerRefundKobo,
      reason:       "dispute_resolution",
      resolution,
      status:       "pending_transfer",   // admin processes actual bank refund
      created_at:   now,
    })

    await AdminService.addDoc("notifications", {
      user_id: buyerId,
      type:    "refund_initiated",
      title:   "✅ Refund Initiated",
      body:    `Your refund of ₦${(buyerRefundKobo / 100).toLocaleString("en-NG")} for order #${orderId.slice(-6).toUpperCase()} has been approved. Bank transfer in 2–5 working days.`,
      link:    "/dashboard/buyer/orders",
      is_read: false,
      created_at: now,
    })
  }

  // ── 5. Update order escrow_status & order status ──────────────────────────
  await AdminService.updateDoc("orders", orderId, {
    status:         orderStatus,
    escrow_status:  escrowStatus,
    updated_at:     now,
    ...(resolution === "refunded"       ? { refunded_at:  now } : {}),
    ...(resolution === "released"       ? { completed_at: now } : {}),
    ...(resolution === "split"          ? { completed_at: now } : {}),
  })

  // FIX: seller previously never got an "Escrow Released" email when a
  // dispute resolved in their favor (full or partial) — only an in-app
  // notification. Gross amount and platform fee are shown as originally
  // recorded on the order; only netPayout reflects the actual amount
  // credited here, which is lower than the full seller_payout for a split.
  if (sellerCreditKobo > 0 && sellerId) {
    await notifyEscrowReleased({ ...orderRow, seller_payout: sellerCreditKobo })
  }
}

// ── Service ───────────────────────────────────────────────────────────────────
export const DisputesService: IDisputesService = {

  async getDisputeById(id) {
    const row = await AdminService.getDoc("disputes", id)
    if (!row) return null
    return mapRow(row as Record<string, unknown>)
  },

  // FIX: was doing a full-table scan + JS filter.
  // Now hits the API route which runs a WHERE clause directly in D1.
  async getDisputesByUser(userId, cursor?) {
    const params = new URLSearchParams({ userId, pageSize: String(PAGE_SIZE) })
    if (cursor) params.set("cursor", cursor)

    const res = await fetch(`/api/disputes/by-user?${params.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? "Failed to load disputes")
    }
    const data = await res.json() as {
      items: Record<string, unknown>[]
      nextCursor: string | null
      hasMore: boolean
    }
    return {
      items:      data.items.map(mapRow),
      nextCursor: data.nextCursor,
      hasMore:    data.hasMore,
    } as PaginatedResult<Dispute>
  },

  async openDispute(data) {
    const res = await fetch("/api/disputes/open", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? "Failed to open dispute")
    }
    return res.json() as Promise<{ id: string }>
  },

  // FIX: now accepts sellerEvidence[] and persists it to D1
  async respondToDispute(disputeId, _sellerId, response, sellerEvidence = []) {
    const res = await fetch("/api/disputes/respond", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ disputeId, response, sellerEvidence }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? "Failed to submit response")
    }
  },

  // FIX: now calls settleEscrow() via the secure API route which moves real money
  async resolveDispute(disputeId, orderId, resolution, adminUid, addToPublicLedger = false, refundPercent?) {
    if (resolution === "split" && (refundPercent == null || refundPercent < 1 || refundPercent > 99)) {
      throw new Error("Split resolution requires refundPercent between 1 and 99")
    }

    const res = await fetch("/api/disputes/resolve", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        disputeId,
        orderId,
        resolution,
        adminUid,
        addToPublicLedger,
        refundPercent: refundPercent ?? null,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? "Failed to resolve dispute")
    }
  },

  async requestArbitration(disputeId, requestedBy, reason) {
    await AdminService.updateDoc("disputes", disputeId, {
      status:                   DISPUTE_STATUS.ESCALATED,
      arbitration_requested:    1,
      arbitration_reason:       reason,
      arbitration_requested_by: requestedBy,
      arbitration_requested_at: new Date().toISOString(),
    })

    await AdminService.addDoc("notifications", {
      user_id:    "admin",
      type:       "arbitration_requested",
      title:      "⚖️ Arbitration Requested",
      body:       `A dispute has been escalated for formal arbitration. Reason: ${reason}`,
      is_read:    false,
      created_at: new Date().toISOString(),
    })
  },
}

// Export settleEscrow for use in the API route (server-side only)
export { settleEscrow }
