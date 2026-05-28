// src/services/disputes.ts
// ─────────────────────────────────────────────────────────────────
// Disputes service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { Dispute, DisputeReason, DisputeVerdict, PaginatedResult } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { DisputesService } from "@/src/services/providers/firebase/disputes"
// ─────────────────────────────────────────────────────────────────

export interface IDisputesService {
  getDisputeById(id: string): Promise<Dispute | null>
  getDisputesByUser(userId: string, cursor?: unknown): Promise<PaginatedResult<Dispute>>

  openDispute(data: {
    orderId: string
    buyerId: string
    sellerId: string
    raisedBy: "buyer" | "seller"
    reason: DisputeReason
    description: string
    evidence?: string[]
  }): Promise<{ id: string }>

  /** Seller submits their response */
  respondToDispute(disputeId: string, sellerId: string, response: string): Promise<void>

  /** Admin / moderator resolves a dispute */
  resolveDispute(
    disputeId: string,
    orderId: string,
    resolution: "refunded" | "released" | "split",
    adminUid: string,
    addToPublicLedger?: boolean,
  ): Promise<void>
}
