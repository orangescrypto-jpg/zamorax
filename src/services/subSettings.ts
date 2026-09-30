// src/services/subSettings.ts
// Separate, small settings doc for anything added AFTER the main
// platformSettings.ts grew too large. Same storage pattern (kv_store via
// /api/admin/sub-settings), but its own key ("config:sub_settings") so it
// never collides with the main config/platform doc.
//
// USAGE IN COMPONENTS:
//   import { useSubSettings } from "@/hooks/useSubSettings"
//   const { settings } = useSubSettings()
//   settings.relatedListingsCount
//
// TO ADD A NEW SETTING IN THE FUTURE:
//   1. Add the field to SubSettings below + a sensible default in DEFAULT_SUB_SETTINGS
//   2. Add a control for it in app/(admin)/admin/sub-settings/page.tsx
//   That's it — the API route and hook are already generic and need no changes.

export interface SubSettings {
  // ── Related listings ("You may also like" row on listing detail pages) ──
  relatedListingsEnabled: boolean
  relatedListingsCount: number   // how many similar listings to show (1–12)

  // ── Seller coupon codes — lets sellers set a standing % discount code
  // on their own listing at creation time (Step 6 of the listing form).
  // Master toggle only — the code/percentage themselves live per-listing
  // on the listing row, not here.
  couponsEnabled: boolean
  couponMaxDiscountPercent: number   // upper bound sellers can set (1–90)

  // ── Sponsored Products row on listing detail pages — shows boosted
  // listings (paid placement, same source as the homepage Featured
  // Listings section) above "You May Also Like", biased toward the same
  // category as the listing being viewed.
  sponsoredListingsEnabled: boolean
  sponsoredListingsCount: number   // how many sponsored listings to show (1–12)

  // ── Cart abandonment reminder — client-side only. Carts are Zustand +
  // localStorage (no server-visible cart to scan), so this nudges a
  // returning buyer with a dismissible banner instead of a server cron.
  cartAbandonmentEnabled: boolean
  cartAbandonmentThresholdHours: number   // how old an item must be to trigger the nudge

  // ── Free Delivery homepage section — shows listings that have a
  // per-listing delivery fee override of 0 (Listing.deliveryFeeOverrideKobo
  // === 0, same flag that drives the "Free Delivery" badge on ListingCard).
  // Master toggle + how many to show on the homepage row; the full list
  // always lives at /free-delivery regardless of this toggle.
  freeDeliveryEnabled: boolean
  freeDeliveryCount: number   // how many to show on the homepage row (1–20)

  // ── Recently Viewed homepage row (device-local — see lib/recentlyViewedLocal.ts) ──
  // NOT the same as the older account+server recentlyViewedEnabled toggle in
  // platformSettings.ts. This one gates the row that reads from THIS
  // browser's localStorage, mixes every category together in one strip
  // (most-recently-viewed first), and works for guests too.
  recentlyViewedLocalEnabled: boolean
  recentlyViewedLocalCount: number   // how many to show on the homepage row (1–20)

  // ── Web Push notifications (VAPID) ──────────────────────────────────────
  // Master toggle plus one toggle per notification type. When the master
  // is off, the opt-in prompt never shows and the send route drops every
  // notification regardless of the per-type toggles below.
  pushMasterEnabled: boolean

  // Buyer opted into a seller's new-listing alerts (seller_follows) --
  // fires when a followed seller's listing goes from pending to active.
  pushNewListingEnabled: boolean

  // Anything happening to the user's own account: order status changes,
  // messages, offers, disputes, escrow release, layaway reminders -- the
  // general "notifications that concern you" bucket.
  pushAccountActivityEnabled: boolean

  // Price drop on a saved/watchlisted listing.
  pushPriceDropEnabled: boolean

  // Back-in-stock alert on a listing the buyer asked to be notified about.
  pushBackInStockEnabled: boolean

  // Layaway-specific reminders: upcoming due date, plan completed, plan
  // defaulted. Separate from pushAccountActivityEnabled so admin can run
  // layaway reminders independently of general account push.
  pushLayawayRemindersEnabled: boolean

  // ── Layaway early exit fee ────────────────────────────────────────────
  // Charged when a buyer voluntarily cancels a layaway plan before it is
  // fully paid, or when a plan expires without reaching 100%. Called the
  // "Layaway Exit Fee" in the admin UI and shown to the buyer at checkout
  // and again at cancellation time, before they confirm. Deducted from
  // the refund; the buyer receives the remainder back to the account they
  // used to fund their first payment on the plan.
  layawayExitFeeType: "percent" | "flat"
  layawayExitFeePercent: number    // used when layawayExitFeeType is "percent"
  layawayExitFeeFlatKobo: number   // used when layawayExitFeeType is "flat"

  // ── Category gating ───────────────────────────────────────────────────
  // Slugs of categories admin has turned OFF. Empty array = every category
  // in constants/categories.ts is enabled (matches the static isActive:true
  // default on every entry). Disabling a slug here hides it from the
  // homepage grid, nav, quick filters, category tab bar, category listings,
  // and the public /categories pages, and blocks sellers from selecting it
  // in the listing form — all without a redeploy.
  disabledCategorySlugs: string[]

  // ── Category display order ────────────────────────────────────────────
  // Slugs in the order admin wants them displayed (homepage grid, nav,
  // quick filters, tab bar, category listings, /categories pages). Every
  // time admin turns a category ON in the sub-settings screen, its slug is
  // appended to the end of this list — so the category admin turned on
  // first sorts before the one admin turned on last. Turning a category
  // OFF does not remove it from this list, only from disabledCategorySlugs
  // above; re-enabling it later re-appends it to the end. Slugs not yet in
  // this list (a fresh install, or a category added after admin last
  // touched ordering) fall back to their position in constants/categories.ts.
  categoryOrder: string[]

  // ── Category section override ─────────────────────────────────────────
  // Slugs whose effective section (Homepage vs. More Categories) differs
  // from their static showOnHomepage in constants/categories.ts. A slug's
  // presence in this list means "flip it" — e.g. a normally-More category
  // whose slug is here shows on Homepage, and a normally-Homepage category
  // whose slug is here shows in More instead. Toggled by the "move to
  // Homepage / move to More" button in the sub-settings admin page.
  // getActiveHomepageCategories/getActiveMoreCategories/getActiveCategories
  // in constants/categories.ts apply this on top of the static list.
  homepageOverrideSlugs: string[]

  // ── Sell for Cash (buyback) ───────────────────────────────────────────
  // Master toggle for the whole Path A / Path B buyback flow. When off,
  // the "Sell for Cash" nav entry and homepage CTA are hidden and the
  // submission route rejects new requests.
  buybackEnabled: boolean

  // ── Listing auto-expiry ──────────────────────────────────────────────
  // Number of days a listing may sit at stock_qty = 0 before it is
  // permanently deleted (D1 row + R2 images). Seller gets a restock
  // notice partway through this window (see lib/listingExpiry.ts).
  listingAutoDeleteDays: number

  // ── Shop by Category homepage grid (components/home/CategoryListings.tsx) ──
  // How many listing cards to show per tab (the "All" tab and each category
  // tab) before the "See more listings" link appears.
  categoryListingsPerTab: number   // 1–50

  // ── Minimum checkout amount (Buy Now, Cart, Layaway) ──────────────────
  // The total value of goods a buyer must reach before they are allowed to
  // check out, kobo. Applies to Buy Now, multi-item Cart, and Layaway
  // alike, checked against the goods total (before delivery fee and buyer
  // convenience fee). 0 means no minimum. Zamorax Enterprises Direct and
  // third-party sellers each get their own independent amount and never
  // affect each other — a cart mixing both checks each seller-type's
  // subtotal against its own minimum.
  checkoutMinAmountDirectKobo: number
  checkoutMinAmountMarketplaceKobo: number

  // ── Order timers (everything date-based on an order lives here) ──────────
  // Auto-confirm: if the seller shipped and the buyer never taps "Received",
  // the order is moved to inspection automatically after this many days
  // (counted from the moment it was marked shipped). Per delivery method.
  orderAutoConfirmEnabled: boolean
  orderAutoConfirmDaysMeetup: number      // seller-arranged / meetup / other
  orderAutoConfirmDaysLogistics: number   // Zamorax Logistics (ZLA) door delivery
  orderAutoConfirmDaysFbz: number         // FBZ Express
  orderAutoConfirmReminderDaysBefore: number  // remind buyer this many days before auto-confirm
  // Inspection window after receipt (manual or auto): buyer can dispute
  // during it, escrow auto-releases to the seller when it ends.
  orderInspectionHours: number
  // How long staff say they'll take to respond to a dispute (display + notices).
  disputeResponseHours: number
  // Admin "Stuck Escrow" list: orders still held after this many days.
  escrowStuckDays: number
  // Days a listing stays boosted when an admin boosts it manually.
  adminBoostDays: number
  // Hours before a buyer's offer expires if the seller doesn't respond.
  offerExpiryHours: number
  // Layaway timers
  layawayDueReminderDays: number        // remind buyer this many days before a plan expires
  layawayRefundConfirmHours: number     // window for buyer to confirm a paid-out refund
  layawayPurgeHours: number             // hours after refund confirmed before the plan is purged
  layawayStaleDepositDays: number       // unconfirmed manual deposits are removed after this
}

export const DEFAULT_SUB_SETTINGS: SubSettings = {
  relatedListingsEnabled: true,
  relatedListingsCount: 4,
  couponsEnabled: true,
  couponMaxDiscountPercent: 50,
  sponsoredListingsEnabled: true,
  sponsoredListingsCount: 6,
  cartAbandonmentEnabled: true,
  cartAbandonmentThresholdHours: 24,
  freeDeliveryEnabled: true,
  freeDeliveryCount: 8,

  recentlyViewedLocalEnabled: true,
  recentlyViewedLocalCount: 10,

  pushMasterEnabled: false,
  pushNewListingEnabled: true,
  pushAccountActivityEnabled: true,
  pushPriceDropEnabled: true,
  pushBackInStockEnabled: true,
  pushLayawayRemindersEnabled: true,

  layawayExitFeeType: "percent",
  layawayExitFeePercent: 10,
  layawayExitFeeFlatKobo: 100000,

  disabledCategorySlugs: [],
  categoryOrder: [],
  homepageOverrideSlugs: [],

  buybackEnabled: true,
  listingAutoDeleteDays: 120,
  categoryListingsPerTab: 8,

  checkoutMinAmountDirectKobo: 0,
  checkoutMinAmountMarketplaceKobo: 0,

  orderAutoConfirmEnabled: true,
  orderAutoConfirmDaysMeetup: 7,
  orderAutoConfirmDaysLogistics: 10,
  orderAutoConfirmDaysFbz: 10,
  orderAutoConfirmReminderDaysBefore: 2,
  orderInspectionHours: 48,
  disputeResponseHours: 48,
  escrowStuckDays: 7,
  adminBoostDays: 7,
  offerExpiryHours: 24,
  layawayDueReminderDays: 3,
  layawayRefundConfirmHours: 24,
  layawayPurgeHours: 12,
  layawayStaleDepositDays: 3,
}

let _cached: SubSettings | null = null

export async function getSubSettings(): Promise<SubSettings> {
  // Server-side: always read fresh from D1, never from the module-level
  // cache. That cache used to be shared across every request on a warm
  // serverless instance, so an admin save (which only invalidates the
  // client-side hook cache) could keep serving stale settings — e.g. a
  // category the admin just disabled would still render on server-rendered
  // pages (/categories, /categories/[slug], sitemap.ts) until the instance
  // cold-started. D1 reads here are cheap and this path isn't hot enough
  // to need caching.
  if (typeof window === "undefined") {
    try {
      const { d1Query } = await import("@/lib/d1")
      await d1Query(
        `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
        [],
      )
      const rows = await d1Query(
        "SELECT value FROM kv_store WHERE key = ? LIMIT 1",
        ["sub_settings"],
      )
      const row = rows?.results?.[0] as { value: string } | undefined

      if (row) {
        return { ...DEFAULT_SUB_SETTINGS, ...(JSON.parse(row.value) as Partial<SubSettings>) }
      }
    } catch { /* use defaults */ }
    return DEFAULT_SUB_SETTINGS
  }

  try {
    const res = await fetch(`/api/admin/sub-settings?t=${Date.now()}`, { cache: "no-store" })
    const json = await res.json()
    if (json?.settings) {
      _cached = { ...DEFAULT_SUB_SETTINGS, ...(json.settings as Partial<SubSettings>) }
      return _cached
    }
  } catch { /* use defaults */ }
  return DEFAULT_SUB_SETTINGS
}

export function invalidateSubSettingsCache() {
  _cached = null
}

export function subscribeToSubSettings(
  callback: (settings: SubSettings) => void
): () => void {
  let active = true

  const poll = async () => {
    if (!active) return
    try {
      const res = await fetch(`/api/admin/sub-settings`, { cache: "no-store" })
      const json = await res.json()
      if (json?.settings) {
        _cached = { ...DEFAULT_SUB_SETTINGS, ...(json.settings as Partial<SubSettings>) }
        callback(_cached)
      }
    } catch { /* non-fatal */ }
  }

  poll()
  const interval = setInterval(poll, 30_000)

  return () => {
    active = false
    clearInterval(interval)
  }
}
