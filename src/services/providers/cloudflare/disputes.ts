// src/services/providers/cloudflare/disputes.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { IDisputesService } from "@/src/services/disputes"
import type { Dispute, PaginatedResult } from "@/src/types"

const PAGE_SIZE = 20

function mapRow(row: Record<string, unknown>): Dispute {
  return {
    id:                String(row.id),
    orderId:           String(row.order_id        ?? row.orderId        ?? ""),
    buyerId:           String(row.buyer_id         ?? row.buyerId         ?? ""),
    sellerId:          String(row.seller_id        ?? row.sellerId        ?? ""),
    raisedBy:          (String(row.raised_by       ?? row.raisedBy        ?? "buyer")) as "buyer" | "seller",
    reason:            String(row.reason            ?? "") as Dispute["reason"],
    description:       String(row.description      ?? ""),
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

export const DisputesService: IDisputesService = {

  async getDisputeById(id) {
    const row = await AdminService.getDoc("disputes", id)
    if (!row) return null
    return mapRow(row as Record<string, unknown>)
  },

  async getDisputesByUser(userId, _cursor) {
    const all = (await AdminService.getCollection("disputes")) as Record<string, unknown>[]
    const filtered = all
      .filter(r => String(r.buyer_id ?? r.buyerId) === userId)
      .sort((a: any, b: any) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
    const page = filtered.slice(0, PAGE_SIZE)
    return { items: page.map(mapRow), nextCursor: null, hasMore: filtered.length > PAGE_SIZE }
  },

  async openDispute(data) {
    const ref = await AdminService.addDoc("disputes", {
      order_id:    data.orderId,
      buyer_id:    data.buyerId,
      seller_id:   data.sellerId,
      reason:      data.reason,
      description: data.description ?? null,
      status:      "open",
    })

    await AdminService.updateDoc("orders", data.orderId, { status: "disputed", dispute_id: ref.id })

    await AdminService.addDoc("notifications", {
      user_id: data.sellerId,
      type:    "dispute_opened",
      title:   "A Dispute Has Been Filed",
      body:    `A buyer filed a dispute for order #${data.orderId.slice(-6).toUpperCase()}. Reason: ${data.reason}. Respond within 48 hours.`,
      is_read: false,
    })

    return { id: ref.id }
  },

  async respondToDispute(disputeId, _sellerId, response) {
    await AdminService.updateDoc("disputes", disputeId, {
      seller_response:     response,
      seller_responded_at: new Date().toISOString(),
      status:              "investigating",
    })
  },

  async resolveDispute(disputeId, orderId, resolution, adminUid, addToPublicLedger = false) {
    await AdminService.updateDoc("disputes", disputeId, {
      status:           "resolved",
      resolution,
      resolved_by:      adminUid,
      resolved_at:      new Date().toISOString(),
      is_public_ledger: addToPublicLedger ? 1 : 0,
      public_summary:   `Resolved by admin: ${resolution}. ${new Date().toLocaleDateString()}`,
    })

    const orderStatus = resolution === "refunded" ? "refunded" : "completed"
    await AdminService.updateDoc("orders", orderId, { status: orderStatus })
  },

  async requestArbitration(disputeId, requestedBy, reason) {
    await AdminService.updateDoc("disputes", disputeId, {
      status:                    "escalated",
      arbitration_requested:     1,
      arbitration_reason:        reason,
      arbitration_requested_by:  requestedBy,
      arbitration_requested_at:  new Date().toISOString(),
    })

    await AdminService.addDoc("notifications", {
      user_id: "admin",
      type:    "arbitration_requested",
      title:   "⚖️ Arbitration Requested",
      body:    `A dispute has been escalated for formal arbitration. Reason: ${reason}`,
      is_read: false,
    })
  },
}
