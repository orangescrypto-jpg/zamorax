// lib/recentlyViewedLocal.ts
//
// Device-local "Recently Viewed" — deliberately NOT tied to a user account.
// Stored in this browser's localStorage only, so:
//   • It works for guests too (no login required).
//   • Categories are mixed together (whatever the person actually looked
//     at — groceries, phones, fashion — in one shared list, most-recent
//     first), matching how someone actually browses.
//   • It reflects THIS phone/browser's browsing, not a synced account
//     history — clearing site data or switching devices starts it fresh.
//
// Distinct from src/services/recentlyViewed.ts (the older, account+server
// version) — kept as-is for anything still reading it, but the homepage
// row now reads from here instead.

const STORAGE_KEY = "zamorax_recently_viewed_v1"
const MAX_STORED = 24 // keep more in storage than we may ever display

export interface RecentlyViewedLocalItem {
  listingId: string
  title: string
  image: string | null
  priceSale: number
  categorySlug?: string | null
  viewedAt: string // ISO
}

function safeParse(raw: string | null): RecentlyViewedLocalItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Record a view — call from the listing detail page for every visitor. */
export function trackRecentlyViewedLocal(item: Omit<RecentlyViewedLocalItem, "viewedAt">): void {
  if (typeof window === "undefined") return
  try {
    const existing = safeParse(localStorage.getItem(STORAGE_KEY))
    const next = [
      { ...item, viewedAt: new Date().toISOString() },
      ...existing.filter(x => x.listingId !== item.listingId),
    ].slice(0, MAX_STORED)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full/unavailable (private browsing, quota) — non-fatal.
  }
}

/** Read the list, most-recently-viewed first, capped to `limit`. */
export function getRecentlyViewedLocal(limit = 10): RecentlyViewedLocalItem[] {
  if (typeof window === "undefined") return []
  return safeParse(localStorage.getItem(STORAGE_KEY)).slice(0, limit)
}

/** Drop one listing (e.g. it was deleted/sold out) without wiping the rest. */
export function removeRecentlyViewedLocal(listingId: string): void {
  if (typeof window === "undefined") return
  try {
    const existing = safeParse(localStorage.getItem(STORAGE_KEY))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(x => x.listingId !== listingId)))
  } catch { /* non-fatal */ }
}
