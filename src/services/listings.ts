// src/services/listings.ts
// ─────────────────────────────────────────────────────────────────
// Listings + Categories service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { Listing, ListingFilters, PaginatedResult, Category } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { ListingsService } from "@/src/services/providers/firebase/listings"
// ─────────────────────────────────────────────────────────────────

export interface IListingsService {
  // ── Public reads ────────────────────────────────────────────────
  getListings(filters?: ListingFilters, cursor?: unknown): Promise<PaginatedResult<Listing>>
  getListingById(id: string): Promise<Listing | null>
  getListingsByIds(ids: string[]): Promise<Listing[]>

  // ── Categories ──────────────────────────────────────────────────
  getCategories(phase?: number): Promise<Category[]>
  getCategoryBySlug(slug: string): Promise<Category | null>

  // ── Seller mutations ────────────────────────────────────────────
  createListing(data: Partial<Listing>, sellerId: string): Promise<{ id: string }>
  updateListing(id: string, data: Partial<Listing>): Promise<void>
  deleteListing(id: string): Promise<void>
  pauseListing(id: string): Promise<void>
  resumeListing(id: string): Promise<void>

  // ── Save / unsave ───────────────────────────────────────────────
  saveListing(listingId: string, userId: string): Promise<void>
  unsaveListing(listingId: string, userId: string): Promise<void>
  getSavedListings(userId: string): Promise<Listing[]>

  // ── Flash deals ─────────────────────────────────────────────────
  createFlashDeal(listingId: string, discountPercent: number, hours: number): Promise<void>
  cancelFlashDeal(listingId: string): Promise<void>

  // ── Admin / moderator ───────────────────────────────────────────
  approveListing(listingId: string, adminUid: string): Promise<void>
  rejectListing(listingId: string, adminUid: string, reason: string): Promise<void>

  // ── Real-time ───────────────────────────────────────────────────
  subscribeToInsurancePool(callback: (balance: number) => void): () => void

  /** Utility: check if a listing's flash deal is currently active */
  isFlashDealActive(listing: Listing): boolean

  /** Utility: calculate discounted price in kobo */
  getFlashPrice(originalKobo: number, discountPercent: number): number
}
