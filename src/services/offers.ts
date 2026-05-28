// src/services/offers.ts
// ─────────────────────────────────────────────────────────────────
// Offers service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { Offer, PaginatedResult } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { OffersService } from "@/src/services/providers/firebase/offers"
// ─────────────────────────────────────────────────────────────────

export interface IOffersService {
  makeOffer(data: {
    listingId: string
    listingTitle: string
    listingImage: string
    originalPrice: number
    offerAmount: number
    buyerId: string
    buyerName: string
    sellerId: string
    sellerName: string
    message?: string
  }): Promise<{ id: string }>

  respondToOffer(
    offerId: string,
    action: "accepted" | "declined" | "countered",
    counterAmount?: number,
  ): Promise<void>

  getOffersByBuyer(buyerId: string): Promise<Offer[]>
  getOffersBySeller(sellerId: string): Promise<Offer[]>
}
