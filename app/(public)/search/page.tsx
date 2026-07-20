"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ListingFilter } from "@/components/listings/ListingFilter"
import { ListingGrid } from "@/components/listings/ListingGrid"
import { useListings } from "@/hooks/useListings"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Store, Zap, Search, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { ALL_CATEGORIES } from "@/constants/categories"
import type { Listing } from "@/src/types"

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const filters = {
    q:             searchParams.get("q")         || undefined,
    category:      searchParams.get("category")  || undefined,
    nigerianState: searchParams.get("state")     || undefined,
    listingType:   searchParams.get("type")      as "sale" | "rent" | "both" | undefined,
    condition:     searchParams.get("condition") as "brand_new" | "open_box" | "grade_a" | "grade_b" | undefined,
    minPrice:      searchParams.get("min") ? Number(searchParams.get("min")) : undefined,
    maxPrice:      searchParams.get("max") ? Number(searchParams.get("max")) : undefined,
    sort:          searchParams.get("sort")      as "newest" | "price_asc" | "price_desc" | "direct_first" | undefined,
    official:      searchParams.get("official") === "true" || undefined,
  }

  const hasActiveFilters = Object.values(filters).some(Boolean)
  const categoryName = filters.category
    ? ALL_CATEGORIES.find(c => c.slug === filters.category)?.name
    : null

  const { listings, loading, error, fetchListings, hasMore } = useListings()

  useEffect(() => {
    fetchListings(filters, true)
  }, [searchParams.toString()])

  const pageTitle = filters.q
    ? `Results for "${filters.q}"`
    : categoryName
    ? categoryName
    : "Browse Listings"

  const handleSortChange = (v: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (v === "newest") params.delete("sort")
    else                 params.set("sort", v)

    // direct_first only has anything to sort — official/picked listings are
    // excluded from normal results otherwise, see /api/listings — so it
    // implies official=true rather than being a no-op on a filtered-out set.
    if (v === "direct_first") params.set("official", "true")
    else                       params.delete("official")

    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-heading font-bold capitalize">{pageTitle}</h1>

        {/* Sort control — "Zamorax Enterprises Direct first" surfaces here
            instead of just being an on/off filter, so buyers can prioritize
            official listings without hiding everything else. */}
        <Select value={filters.sort ?? "newest"} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="direct_first">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Zamorax Enterprises Direct first</span>
            </SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0">
          <ListingFilter />
        </div>

        <div className="flex-1">
          {error ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-destructive font-medium">Failed to load listings.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[320px] rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            // ── Smart empty state — never a blank, never a 404 ───────────────
            <div className="flex flex-col items-center justify-center py-20 gap-5 rounded-2xl border border-dashed border-border bg-muted/20 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                {hasActiveFilters
                  ? <Search className="h-7 w-7 text-primary" />
                  : <Store className="h-7 w-7 text-primary" />
                }
              </div>
              <div className="max-w-sm">
                <p className="font-semibold text-lg text-foreground">
                  {hasActiveFilters
                    ? "No listings match your search"
                    : "No listings yet — be the first!"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {hasActiveFilters
                    ? "Try removing some filters, or be the first to list in this category."
                    : "Zamorax is just launching. Post your item today and reach thousands of buyers across Nigeria."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {hasActiveFilters && (
                  <Button variant="outline" asChild>
                    <Link href="/search">Clear Filters</Link>
                  </Button>
                )}
                <Button
                  className="bg-primary text-white hover:bg-primary/90 gap-2"
                  onClick={() => router.push("/dashboard/seller/post")}
                >
                  <Zap className="h-4 w-4" />
                  Post a Free Ad
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing as unknown as Listing} />
                ))}
              </div>

              {hasMore && !loading && (
                <div className="mt-8 text-center">
                  <Button variant="outline" onClick={() => fetchListings(filters)} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Load More"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="container py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mt-20 block" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}

// Fix missing import that was in original file
import { ListingCard } from "@/components/listings/ListingCard"
