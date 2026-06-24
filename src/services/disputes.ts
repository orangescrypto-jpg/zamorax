// src/services/disputes.ts
// WAS FIREBASE → NOW CLOUDFLARE D1
import type { Dispute, DisputeReason, PaginatedResult } from "@/src/types"
export { DisputesService } from "@/src/services/providers/cloudflare/disputes"
export interface IDisputesService {
  getDisputeById(id: string): Promise<Dispute | null>
  getDisputesByUser(userId: string, cursor?: unknown): Promise<PaginatedResult<Dispute>>
  openDispute(data: { orderId: string; buyerId: string; sellerId: string; raisedBy: "buyer" | "seller"; reason: DisputeReason; description: string; evidence?: string[] }): Promise<{ id: string }>
  respondToDispute(disputeId: string, sellerId: string, response: string): Promise<void>
  resolveDispute(disputeId: string, orderId: string, resolution: "refunded" | "released" | "split", adminUid: string, addToPublicLedger?: boolean): Promise<void>
  requestArbitration(disputeId: string, requestedBy: string, reason: string): Promise<void>
}
