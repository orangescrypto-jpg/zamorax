"use client"
// hooks/useListings.ts
// Calls ListingsService.getListings → /api/listings (server-side D1 query).
// Auto-fetches on mount with initialFilters so categories page shows listings immediately.

import { useState, useCallback, useEffect, useRef } from "react"
import { ListingsService } from "@/src/services/listings"
import type { Listing, ListingFilters } from "@/src/types"

export function useListings(initialFilters: ListingFilters = {}) {
  const [listings,   setListings]   = useState<Listing[]>([])
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
    fetchListings(initialFiltersRef.current, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { listings, loading, error, fetchListings, hasMore, setHasMore, setNextCursor }
}
