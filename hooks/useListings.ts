// hooks/useListings.ts
"use client"
// Calls ListingsService.getListings → /api/listings (server-side D1 query).
// Auto-fetches on mount with initialFilters so categories page shows listings immediately.

import { useState, useCallback, useEffect, useRef } from "react"
import { ListingsService } from "@/src/services/listings"
import type { Listing, ListingFilters } from "@/src/types"

export function useListings(
  initialFilters: ListingFilters = {},
  // Listings fetched on the server (SSR). When provided we render them immediately
  // (so Google sees real products in the HTML) and skip the on-mount refetch.
  initialItems?: Listing[] | null,
) {
  const [listings,   setListings]   = useState<Listing[]>(initialItems ?? [])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<unknown>(null)
  const [hasMore,    setHasMore]    = useState(true)

  // Stable ref so the auto-fetch effect doesn't re-run on every render
  const initialFiltersRef = useRef(initialFilters)

  const fetchListings = useCallback(
    async (filters: ListingFilters, reset = false) => {
      setLoading(true)
      setError(null)

      if (reset) {
        setListings([])
        setNextCursor(null)
        setHasMore(true)
      }

      try {
        const result = await ListingsService.getListings(
          filters,
          reset ? undefined : nextCursor,
        )

        setListings(prev => reset ? result.items : [...prev, ...result.items])
        setNextCursor(result.nextCursor)
        setHasMore(result.hasMore)
      } catch (err) {
        console.error("useListings error:", err)
        setError("Failed to load listings. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [nextCursor],
  )

  // Auto-fetch on mount with the initial filters passed in (e.g. category slug)
  useEffect(() => {
    if (initialItems) return // already have server-rendered data
    fetchListings(initialFiltersRef.current, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { listings, loading, error, fetchListings, hasMore, setHasMore, setNextCursor }
}
