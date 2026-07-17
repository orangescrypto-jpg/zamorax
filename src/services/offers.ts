// src/services/offers.ts
// WAS FIREBASE → NOW CLOUDFLARE D1
import type { Offer } from "@/src/types"
export { OffersService } from "@/src/services/providers/cloudflare/offers"
export interface IOffersService {
  makeOffer(data: { listingId: string; listingTitle: string; listingImage: string; originalPrice: number; offerAmount: number; buyerId: string; buyerName: string; sellerId: string; sellerName: string; message?: string }): Promise<{ id: string }>
  respondToOffer(offerId: string, action: "accepted" | "declined" | "countered", counterAmount?: number): Promise<void>
  acceptCounterOffer(offerId: string, counterAmount: number): Promise<void>
  getAcceptedOffer(listingId: string, buyerId: string): Promise<{ offerId: string; agreedPrice: number; originalPrice: number; acceptedAt: string } | null>
  markOfferUsed(listingId: string, buyerId: string): Promise<void>
  getOffersByBuyer(buyerId: string): Promise<Offer[]>
  getOffersBySeller(sellerId: string): Promise<Offer[]>
  /** Flips any pending/accepted offer past its 24h expires_at into "expired". */
  expireStaleOffers(): Promise<{ expiredCount: number }>
  /** Permanently deletes every offer row currently marked "expired". Admin-only. */
  deleteExpiredOffers(): Promise<{ deletedCount: number }>
}
