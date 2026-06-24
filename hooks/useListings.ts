"use client"
// hooks/useListings.ts  ← UPDATED
// Uses ListingsService instead of calling Firebase directly.
// Zero Firebase imports here — this is what every hook should look like.

import { useState, useCallback } from "react"
import { ListingsService } from "@/src/services/listings"
import type { Listing, ListingFilters } from "@/src/types"

export function useListings(initialFilters: ListingFilters = {}) {
  const [listings,   setListings]   = useState<Listing[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<unknown>(null)
  const [hasMore,    setHasMore]    = useState(true)

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

  return { listings, loading, error, fetchListings, hasMore, setHasMore, setNextCursor }
}
