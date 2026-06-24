// store/filtersStore.ts
// Zustand store for listing search filters and sort state.
// Centralises filter state that was previously scattered across useState calls
// in search, listings, and category pages.

import { create } from "zustand"
import type { ListingFilters } from "@/src/types"

interface FiltersState {
  filters: ListingFilters
  activeTab: string

  // Actions
  setFilter<K extends keyof ListingFilters>(key: K, value: ListingFilters[K]): void
  setFilters(filters: Partial<ListingFilters>): void
  resetFilters(): void
  setActiveTab(tab: string): void
  setQuery(q: string): void
}

const defaultFilters: ListingFilters = {
  q:           undefined,
  category:    undefined,
  listingType: undefined,
  condition:   undefined,
  nigerianState: undefined,
  minPrice:    undefined,
  maxPrice:    undefined,
  verified:    undefined,
  sort:        "newest",
}

export const useFiltersStore = create<FiltersState>()((set) => ({
  filters:   defaultFilters,
  activeTab: "all",

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  resetFilters: () =>
    set({ filters: defaultFilters, activeTab: "all" }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  setQuery: (q) =>
    set((state) => ({ filters: { ...state.filters, q } })),
}))
