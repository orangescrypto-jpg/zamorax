// lib/algolia/client.ts
// npm install algoliasearch

import algoliasearch from "algoliasearch"

// Public search-only client (safe to use in browser)
export const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!   // search-only key — never expose admin key
)

export const LISTINGS_INDEX = "zamorax_listings"

// ── Shape of an Algolia listing record ────────────────────────────────────────
export interface AlgoliaListing {
  objectID: string          // = Firestore listingId
  title: string
  description: string
  categorySlug: string
  categoryName: string
  listingType: "sale" | "rent" | "both"
  condition: string
  priceSale: number         // kobo
  priceRentDaily?: number   // kobo
  nigerianState: string
  city: string
  images: string[]
  isHubVerified: boolean
  isBoosted: boolean
  sellerName: string
  sellerRating: number
  sellerVerified: boolean
  status: string
  createdAtTimestamp: number  // Unix seconds for sorting
  _geoloc?: { lat: number; lng: number }
}
