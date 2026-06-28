// src/services/disputes.ts
// WAS FIREBASE → NOW CLOUDFLARE D1
import type { Dispute, DisputeReason, PaginatedResult } from "@/src/types"
export { DisputesService } from "@/src/services/providers/cloudflare/disputes"
export interface IDisputesService {
  getDisputeById(id: string): Promise<Dispute | null>
  getDisputesByUser(userId: string, cursor?: string): Promise<PaginatedResult<Dispute>>
  openDispute(data: {
    orderId: string
    buyerId: string
    sellerId: string
    raisedBy: "buyer" | "seller"
    reason: DisputeReason
    description: string
    evidence?: string[]
  }): Promise<{ id: string }>
  respondToDispute(
    disputeId: string,
    sellerId: string,
    response: string,
    sellerEvidence?: string[],
  ): Promise<void>
  resolveDispute(
    disputeId: string,
    orderId: string,
    resolution: "refunded" | "released" | "split",
    adminUid: string,
    addToPublicLedger?: boolean,
    /** Required when resolution === "split". Integer 1–99, percentage refunded to buyer. */
    refundPercent?: number,
  ): Promise<void>
  requestArbitration(disputeId: string, requestedBy: string, reason: string): Promise<void>
}
