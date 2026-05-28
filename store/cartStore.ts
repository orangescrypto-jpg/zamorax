// store/cartStore.ts
// Zustand store for saved/wishlist state and offer selection state.
// The Zamorax marketplace uses "save listing" rather than a traditional cart,
// but this store provides a consistent interface for that state and for
// multi-step offer/checkout flows.

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Listing } from "@/src/types"

interface SavedItem {
  listingId: string
  savedAt:   string // ISO
  listing?:  Pick<Listing, "id" | "title" | "images" | "priceSale" | "nigerianState" | "sellerId">
}

interface OfferDraft {
  listingId:  string
  offeredPrice: number
  message?:   string
}

interface CartState {
  // Locally cached saved items (synced with Firestore via service layer)
  savedItems:  SavedItem[]
  savedIds:    Set<string>

  // Active offer draft
  offerDraft: OfferDraft | null

  // Actions — saved items
  addSaved(item: SavedItem):    void
  removeSaved(listingId: string): void
  isSaved(listingId: string):   boolean
  hydrateSaved(items: SavedItem[]): void
  clearSaved(): void

  // Actions — offer draft
  setOfferDraft(draft: OfferDraft | null): void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      savedItems: [],
      savedIds:   new Set<string>(),
      offerDraft: null,

      addSaved: (item) =>
        set((s) => ({
          savedItems: [item, ...s.savedItems.filter((x) => x.listingId !== item.listingId)],
          savedIds:   new Set([...s.savedIds, item.listingId]),
        })),

      removeSaved: (listingId) =>
        set((s) => {
          const next = new Set(s.savedIds)
          next.delete(listingId)
          return {
            savedItems: s.savedItems.filter((x) => x.listingId !== listingId),
            savedIds:   next,
          }
        }),

      isSaved: (listingId) => get().savedIds.has(listingId),

      hydrateSaved: (items) =>
        set({
          savedItems: items,
          savedIds:   new Set(items.map((i) => i.listingId)),
        }),

      clearSaved: () => set({ savedItems: [], savedIds: new Set() }),

      setOfferDraft: (draft) => set({ offerDraft: draft }),
    }),
    {
      name: "zamorax-cart",
      // Don't persist savedIds Set — rebuild from savedItems on rehydrate
      partialize: (state) => ({ savedItems: state.savedItems, offerDraft: state.offerDraft }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.savedIds = new Set(state.savedItems.map((i) => i.listingId))
        }
      },
    }
  )
)
