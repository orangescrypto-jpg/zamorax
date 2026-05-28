"use client"
// hooks/useAlgoliaSearch.ts

import { useState, useCallback, useRef } from "react"
import { searchClient, LISTINGS_INDEX, AlgoliaListing } from "@/lib/algolia/client"
import type { SearchResponse } from "@algolia/client-search"
import { query } from "@/src/services"

export interface AlgoliaFilters {
  q?: string
  category?: string
  listingType?: string
  condition?: string
  nigerianState?: string
  minPrice?: number
  maxPrice?: number
  hubVerified?: boolean
  sort?: "price_asc" | "price_desc" | "newest" | "relevance"
  page?: number
}

const PAGE_SIZE = 12

export function useAlgoliaSearch() {
  const [results, setResults]     = useState<AlgoliaListing[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [totalHits, setTotalHits] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [queryID, setQueryID]     = useState<string | undefined>()  // for Algolia Click Analytics

  // Debounce ref
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined)

  const search = useCallback(async (filters: AlgoliaFilters, append = false) => {
    clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        // ── Build Algolia facet filters ──────────────────────────────────────
        const facetFilters: string[][] = [
          ["status:active"],
        ]
        if (filters.category)     facetFilters.push([`categorySlug:${filters.category}`])
        if (filters.listingType)  facetFilters.push([`listingType:${filters.listingType}`])
        if (filters.condition)    facetFilters.push([`condition:${filters.condition}`])
        if (filters.nigerianState) facetFilters.push([`nigerianState:${filters.nigerianState}`])
        if (filters.hubVerified)  facetFilters.push(["isHubVerified:true"])

        // ── Price range filter ────────────────────────────────────────────────
        let numericFilters: string[] = []
        if (filters.minPrice) numericFilters.push(`priceSale >= ${filters.minPrice * 100}`)
        if (filters.maxPrice) numericFilters.push(`priceSale <= ${filters.maxPrice * 100}`)

        // ── Index to query (different sort orders use replica indices) ────────
        let indexName = LISTINGS_INDEX
        if (filters.sort === "price_asc")  indexName = `${LISTINGS_INDEX}_price_asc`
        if (filters.sort === "price_desc") indexName = `${LISTINGS_INDEX}_price_desc`
        if (filters.sort === "newest")     indexName = `${LISTINGS_INDEX}_newest`

        const idx = searchClient.initIndex(indexName)

        const response: SearchResponse<AlgoliaListing> = await idx.search(
          filters.q || "",
          {
            facetFilters,
            numericFilters,
            page: filters.page || 0,
            hitsPerPage: PAGE_SIZE,
            clickAnalytics: true,
            // Return highlighted snippets for title/description
            attributesToSnippet: ["description:20"],
            snippetEllipsisText: "…",
          }
        )

        const hits = response.hits as AlgoliaListing[]
        setResults(prev => append ? [...prev, ...hits] : hits)
        setTotalHits(response.nbHits)
        setTotalPages(response.nbPages)
        setCurrentPage(response.page)
        setQueryID(response.queryID)

      } catch (e: any) {
        console.error("Algolia search error:", e)
        setError("Search failed. Please try again.")
      } finally {
        setLoading(false)
      }
    }, 200) // 200ms debounce — feels instant but avoids hammering on keypress
  }, [])

  const loadMore = useCallback((filters: AlgoliaFilters) => {
    if (currentPage + 1 < totalPages) {
      search({ ...filters, page: currentPage + 1 }, true)
    }
  }, [currentPage, totalPages, search])

  return {
    results,
    loading,
    error,
    totalHits,
    totalPages,
    currentPage,
    queryID,
    hasMore: currentPage + 1 < totalPages,
    search,
    loadMore,
  }
}
