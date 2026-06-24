// store/cartStore.ts
// Zustand store for saved/wishlist state, offer selection state, AND multi-item cart.
// ─────────────────────────────────────────────────────────────────────────────
// WISHLIST (savedItems) — persisted under "zamorax-cart" (unchanged key)
// CART (cartItems)      — persisted under "zamorax-cart-v2" (new key)
// Both live in separate persist slices so they never interfere.

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { Listing, CartItem, DeliveryMethod } from "@/src/types"

// ─── Saved items (wishlist) ───────────────────────────────────────────────
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

interface WishlistState {
  savedItems:  SavedItem[]
  savedIds:    Set<string>
  offerDraft: OfferDraft | null
  addSaved(item: SavedItem):    void
  removeSaved(listingId: string): void
  isSaved(listingId: string):   boolean
  hydrateSaved(items: SavedItem[]): void
  clearSaved(): void
  setOfferDraft(draft: OfferDraft | null): void
}

export const useWishlistStore = create<WishlistState>()(
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
      partialize: (state) => ({ savedItems: state.savedItems, offerDraft: state.offerDraft }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.savedIds = new Set(state.savedItems.map((i) => i.listingId))
        }
      },
    }
  )
)

// ─── Backwards-compat: keep useCartStore pointing to wishlist store ────────
// Components that import useCartStore for wishlist functionality continue to work.
// New cart functionality is accessed via useCartItemsStore below.
export const useCartStore = useWishlistStore

// ─── Multi-item cart ──────────────────────────────────────────────────────
interface CartItemsState {
  cartItems: CartItem[]

  // Mutations
  addToCart(item: CartItem, maxQtyPerItem?: number): void
  removeFromCart(listingId: string): void
  updateQty(listingId: string, qty: number): void
  clearCart(): void

  // Reads
  getCartItems(): CartItem[]
  getCartGrouped(): Record<string, CartItem[]>   // keyed by sellerId
  getCartTotal(): number                          // kobo — sum without delivery
  getItemCount(): number                          // total distinct items

  // Offer hydration — call after fetching accepted offers for cart listings
  hydrateAcceptedOffers(offers: Record<string, number>): void  // listingId → agreedPrice kobo
}

export const useCartItemsStore = create<CartItemsState>()(
  persist(
    (set, get) => ({
      cartItems: [],

      addToCart: (item, maxQtyPerItem = 10) => {
        set((s) => {
          const existing = s.cartItems.find((c) => c.listingId === item.listingId)
          if (existing) {
            return {
              cartItems: s.cartItems.map((c) =>
                c.listingId === item.listingId
                  ? { ...c, quantity: Math.min(c.quantity + item.quantity, maxQtyPerItem) }
                  : c
              ),
            }
          }
          return {
            cartItems: [
              ...s.cartItems,
              { ...item, quantity: Math.min(item.quantity, maxQtyPerItem) },
            ],
          }
        })
      },

      removeFromCart: (listingId) =>
        set((s) => ({ cartItems: s.cartItems.filter((c) => c.listingId !== listingId) })),

      updateQty: (listingId, qty) =>
        set((s) => ({
          cartItems:
            qty <= 0
              ? s.cartItems.filter((c) => c.listingId !== listingId)
              : s.cartItems.map((c) =>
                  c.listingId === listingId ? { ...c, quantity: qty } : c
                ),
        })),

      clearCart: () => set({ cartItems: [] }),

      getCartItems: () => get().cartItems,

      getCartGrouped: () => {
        const grouped: Record<string, CartItem[]> = {}
        for (const item of get().cartItems) {
          if (!grouped[item.sellerId]) grouped[item.sellerId] = []
          grouped[item.sellerId].push(item)
        }
        return grouped
      },

      getCartTotal: () =>
        get().cartItems.reduce((sum, item) => {
          const price = item.agreedPrice ?? item.priceSale
          return sum + price * item.quantity
        }, 0),

      getItemCount: () => get().cartItems.length,

      hydrateAcceptedOffers: (offers) =>
        set((s) => ({
          cartItems: s.cartItems.map((item) =>
            offers[item.listingId] != null
              ? { ...item, agreedPrice: offers[item.listingId] }
              : item
          ),
        })),
    }),
    {
      name: "zamorax-cart-v2",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
