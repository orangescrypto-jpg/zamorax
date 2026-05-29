"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { ListingFilter } from "@/components/listings/ListingFilter"
import { ListingGrid } from "@/components/listings/ListingGrid"
import { useListings } from "@/hooks/useListings"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { Listing } from "@/src/types"

function SearchContent() {
  const searchParams = useSearchParams()

  const filters = {
    q: searchParams.get("q") || undefined,
    category: searchParams.get("category") || undefined,
    nigerianState: searchParams.get("state") || undefined,
    listingType: searchParams.get("type") as "sale" | "rent" | "both" | undefined,
    condition: searchParams.get("condition") as "brand_new" | "open_box" | "grade_a" | "grade_b" | undefined,
    minPrice: searchParams.get("min") ? Number(searchParams.get("min")) : undefined,
    maxPrice: searchParams.get("max") ? Number(searchParams.get("max")) : undefined,
    sort: searchParams.get("sort") as "newest" | "price_asc" | "price_desc" | undefined,
  }

  const { listings, loading, error, fetchListings, hasMore } = useListings()

  useEffect(() => {
    fetchListings(filters, true)
  }, [searchParams.toString()])

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-heading font-bold mb-6 capitalize">
        {filters.q ? `Results for "${filters.q}"` : "Browse Listings"}
      </h1>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0">
          <ListingFilter />
        </div>

        <div className="flex-1">
          <ListingGrid listings={listings as unknown as Listing[]} loading={loading} error={error} />

          {hasMore && !loading && listings.length > 0 && (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => fetchListings(filters)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Load More"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container py-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mt-20 block" /></div>}>
      <SearchContent />
    </Suspense>
  )
}
