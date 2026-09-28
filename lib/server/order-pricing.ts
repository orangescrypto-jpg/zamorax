// lib/server/order-pricing.ts
// ─────────────────────────────────────────────────────────────────
// Server-side price authority for order payments.
//
// WHY THIS EXISTS
// Every order-payment route used to trust totalAmount / itemPrice /
// platformFee / sellerPayout straight from the browser. This module
// recomputes the lowest price a real buyer could legitimately have been
// shown (listing price, flash deal, standing discount, coupon, bulk tier,
// verified offer) plus the buyer fee and delivery fee, so a route can
// reject a forged amount BEFORE money moves, and always derive the
// platform fee / seller payout itself.
//
// Rule of thumb: this only ever enforces a LOWER BOUND. Paying more than
// the floor is harmless to the platform, so anything >= floor passes.
// ─────────────────────────────────────────────────────────────────

import { d1Query } from "@/lib/d1"
import { AdminService } from "@/src/services/admin"
import { calculateFees, DEFAULT_FEE_SETTINGS, type FeeSettings } from "@/src/services/feeSettings"
import { LogisticsService } from "@/src/services/logistics"
import { resolveBulkPrice, type BulkTier } from "@/lib/utils"

// A flash deal that ended a few minutes ago still honours the price a buyer
// saw when they opened checkout.
const FLASH_GRACE_MS = 30 * 60_000
// Item-price rounding drift allowed per unit (bulk unit prices are rounded).
const ROUND_TOLERANCE_PER_UNIT = 1
// Delivery quotes can differ by a rounding step between client and server.
const DELIVERY_TOLERANCE_KOBO = 100

export interface ServerListing {
  id: string
  sellerId: string
  status: string
  priceSale: number
  stockQty: number | null
  minOrderQty: number | null
  flash: { discountPercent: number; expiresAt: string; applyToBulk: boolean } | null
  standing: { discountPercent: number; applyToBulk: boolean } | null
  coupon: { code: string; discountPercent: number } | null
  bulkPricing: BulkTier[] | null
  weightKg: number | null
  isFragile: boolean
  isFBZ: boolean
  deliveryFeeOverrideKobo: number | null
  nigerianState: string
}

function rows(res: unknown): Record<string, unknown>[] {
  return ((res as any)?.results ?? []) as Record<string, unknown>[]
}

function parseJson<T>(v: unknown): T | null {
  if (v == null || v === "") return null
  if (typeof v === "object") return v as T
  try { return JSON.parse(String(v)) as T } catch { return null }
}

export async function loadServerListing(listingId: string, nativeDB?: unknown): Promise<ServerListing | null> {
  const r = rows(await d1Query("SELECT * FROM listings WHERE id = ? LIMIT 1", [listingId], nativeDB))[0]
  if (!r) return null

  const flashRaw = parseJson<{ discountPercent?: number; expiresAt?: string; applyToBulk?: boolean }>(r.flash_deal)
  const flash = flashRaw?.expiresAt && Number(flashRaw.discountPercent) > 0
    ? { discountPercent: Number(flashRaw.discountPercent), expiresAt: String(flashRaw.expiresAt), applyToBulk: !!flashRaw.applyToBulk }
    : null

  const standing = r.standing_discount_enabled && Number(r.standing_discount_percent) > 0
    ? { discountPercent: Number(r.standing_discount_percent), applyToBulk: !!r.standing_discount_apply_to_bulk }
    : null

  const coupon = r.coupon_enabled && r.coupon_code && Number(r.coupon_discount_percent) > 0
    ? { code: String(r.coupon_code).toUpperCase(), discountPercent: Number(r.coupon_discount_percent) }
    : null

  const bulk = parseJson<BulkTier[]>(r.bulk_pricing)

  return {
    id: String(r.id),
    sellerId: String(r.seller_id ?? ""),
    status: String(r.status ?? ""),
    priceSale: Number(r.price ?? 0),
    stockQty: r.stock_qty != null ? Number(r.stock_qty) : null,
    minOrderQty: r.min_order_qty != null ? Number(r.min_order_qty) : null,
    flash,
    standing,
    coupon,
    bulkPricing: Array.isArray(bulk) && bulk.length ? bulk : null,
    weightKg: r.weight_kg ? Number(r.weight_kg) : null,
    isFragile: !!r.is_fragile,
    isFBZ: !!r.is_fbz,
    deliveryFeeOverrideKobo: r.delivery_fee_override_kobo != null ? Number(r.delivery_fee_override_kobo) : null,
    nigerianState: String(r.nigerian_state ?? r.seller_state ?? ""),
  }
}

export async function loadServerFees(): Promise<FeeSettings> {
  // Read straight from storage — the module-level cache in feeSettings.ts can
  // outlive an admin's fee change on a warm serverless instance.
  try {
    const doc = await AdminService.getDoc("config", "fees")
    if (doc) return { ...DEFAULT_FEE_SETTINGS, ...(doc as Partial<FeeSettings>) }
  } catch { /* fall through to defaults */ }
  return DEFAULT_FEE_SETTINGS
}

// ── Item price floor ─────────────────────────────────────────────
// The lowest TOTAL (kobo) for `qty` units that the storefront could have
// produced for this listing right now. Mirrors ListingDetailClient.
export function floorItemTotalKobo(
  listing: ServerListing,
  qty: number,
  opts: { couponCode?: string | null } = {},
): number {
  const P = listing.priceSale
  const now = Date.now()

  const flashActive = !!listing.flash && new Date(listing.flash.expiresAt).getTime() + FLASH_GRACE_MS > now
  const flashPct = flashActive ? listing.flash!.discountPercent : 0
  const standingPct = !flashActive && listing.standing ? listing.standing.discountPercent : 0

  // A coupon only counts when the buyer asserts its code and it matches.
  const couponOk =
    !flashActive &&
    !!listing.coupon &&
    !!opts.couponCode &&
    String(opts.couponCode).trim().toUpperCase() === listing.coupon.code
  const couponPct = couponOk ? listing.coupon!.discountPercent : 0

  const unitPct = flashActive ? flashPct : Math.max(standingPct, couponPct)
  const unitFloor = Math.round(P * (1 - unitPct / 100))
  let floor = unitFloor * qty

  const bulkDiscount =
    flashActive && listing.flash!.applyToBulk ? flashPct
    : !flashActive && listing.standing?.applyToBulk ? standingPct
    : null
  const bulk = resolveBulkPrice(listing.bulkPricing, P, qty, bulkDiscount)
  if (bulk) floor = Math.min(floor, bulk.total)

  return Math.max(0, floor - ROUND_TOLERANCE_PER_UNIT * qty)
}

// ── Offer price ──────────────────────────────────────────────────
// The trusted negotiated price comes from the `offers` row (agreed by the
// seller), never from the client or from accepted_offers alone.
export async function loadVerifiedOffer(
  offerId: string,
  buyerId: string,
  listing: ServerListing,
  nativeDB?: unknown,
): Promise<{ agreedTotalKobo: number; quantity: number } | null> {
  const o = rows(await d1Query("SELECT * FROM offers WHERE id = ? LIMIT 1", [offerId], nativeDB))[0]
  if (!o) return null
  if (String(o.buyer_id) !== buyerId) return null
  if (String(o.listing_id) !== listing.id) return null
  if (String(o.seller_id) !== listing.sellerId) return null
  if (!["accepted", "used"].includes(String(o.status))) return null

  const counter = Number(o.counter_amount ?? 0)
  const agreed = counter > 0 ? counter : Number(o.offer_amount ?? 0)
  if (!(agreed > 0)) return null
  return { agreedTotalKobo: agreed, quantity: Math.max(1, Number(o.quantity ?? 1) || 1) }
}

// ── Delivery fee ─────────────────────────────────────────────────
// Best effort. Returns null when it cannot be computed reliably (missing
// config, unknown method) so the caller skips the delivery check instead of
// blocking a legitimate buyer on an infrastructure hiccup.
export async function computeDeliveryFeeKobo(
  listing: ServerListing,
  args: { method: string; buyerState: string; qty: number; isDoorstep: boolean },
  nativeDB?: unknown,
): Promise<number | null> {
  try {
    if (listing.deliveryFeeOverrideKobo != null) return listing.deliveryFeeOverrideKobo
    if (args.method === "meetup" || !args.method) return 0

    const weightKg = (listing.weightKg ?? 0.5) * Math.max(1, args.qty)
    const opts = { weightKg, isFragile: listing.isFragile, isDoorstep: args.isDoorstep }

    if (args.method === "fbz") {
      const wh = rows(await d1Query("SELECT * FROM fbz_warehouses WHERE is_active = 1", [], nativeDB))
      if (!wh.length) return null
      const chosen = wh.find(w => String(w.state) === args.buyerState) ?? wh[0]
      const fee = await LogisticsService.getFbzDeliveryFee(String(chosen.state), args.buyerState, opts)
      return fee.total
    }
    if (args.method === "zamorax_logistics") {
      if (!listing.nigerianState) return null
      const pricing = await LogisticsService.getPricing()
      return LogisticsService.calculateFee(listing.nigerianState, args.buyerState, pricing, opts).total
    }
    return null
  } catch (err) {
    console.error("[order-pricing] delivery fee recompute failed (check skipped):", err)
    return null
  }
}

// ── Buy Now draft verification ───────────────────────────────────
export type DraftCheck =
  | { ok: true; draft: Record<string, any>; expectedTotalKobo: number }
  | { ok: false; status: number; error: string }

const fail = (status: number, error: string): DraftCheck => ({ ok: false, status, error })

/**
 * Validates a single-item (Buy Now) order draft against server-side truth and
 * returns a rewritten draft whose money fields (itemPrice, platformFee,
 * sellerPayout, totalAmount) are derived here, never copied from the client.
 *
 * `claimedTotalKobo` is what the client wants to charge; it must be >= the
 * server total (within a small delivery tolerance).
 */
export async function verifyBuyNowDraft(
  draft: Record<string, any>,
  ctx: { buyerUid: string; claimedTotalKobo: number; nativeDB?: unknown },
): Promise<DraftCheck> {
  const { buyerUid, claimedTotalKobo, nativeDB } = ctx

  if (!draft || typeof draft !== "object") return fail(400, "Missing order draft")
  if (String(draft.buyerId ?? "") !== buyerUid) return fail(403, "Order does not belong to this account")

  const listingId = String(draft.listingId ?? "")
  if (!listingId) return fail(400, "Order draft missing listing")
  const listing = await loadServerListing(listingId, nativeDB)
  if (!listing) return fail(404, "This listing is no longer available.")
  if (listing.status !== "active") return fail(409, "This listing is no longer available.")

  // The seller is a server fact — never accept the draft's sellerId.
  const li = Array.isArray(draft.lineItems) ? draft.lineItems[0] : null
  const qty = Math.max(1, Math.floor(Number(li?.qty ?? 1)) || 1)

  if (listing.minOrderQty && listing.minOrderQty > 1 && qty < listing.minOrderQty) {
    return fail(409, `Minimum order for this item is ${listing.minOrderQty}.`)
  }
  if (listing.stockQty != null && listing.stockQty < qty) {
    return fail(409, `Only ${listing.stockQty} left in stock.`)
  }

  // ── item price floor ──
  let floorItem: number
  let offerId: string | null = null
  let effectiveQty = qty
  if (draft.isOfferOrder) {
    offerId = String(draft.offerId ?? li?.offerId ?? "")
    if (!offerId) return fail(400, "Offer order is missing its offer.")
    const offer = await loadVerifiedOffer(offerId, buyerUid, listing, nativeDB)
    if (!offer) return fail(409, "This offer is no longer valid.")
    floorItem = offer.agreedTotalKobo
    effectiveQty = offer.quantity
  } else {
    floorItem = floorItemTotalKobo(listing, qty, { couponCode: li?.couponCode ?? draft.couponCode ?? null })
  }

  const claimedItem = Number(draft.itemPrice ?? 0)
  if (!Number.isFinite(claimedItem) || claimedItem < floorItem) {
    return fail(409, "The price of this item has changed. Please refresh the page and try again.")
  }
  // An offer is fixed; otherwise trust the (>= floor) figure the buyer is paying.
  const itemPriceKobo = draft.isOfferOrder ? floorItem : Math.round(claimedItem)

  // ── fees are derived here, from server fee settings ──
  const fees = await loadServerFees()
  const breakdown = calculateFees(itemPriceKobo, "sale", fees)

  // ── delivery ──
  const method = String(draft.deliveryMethod ?? "meetup")
  const serverDelivery = await computeDeliveryFeeKobo(listing, {
    method,
    buyerState: String(draft.deliveryState ?? draft.buyerState ?? ""),
    qty: effectiveQty,
    isDoorstep: draft.isDoorstepDelivery !== false,
  }, nativeDB)
  const claimedDelivery = Math.max(0, Number(draft.deliveryFee ?? 0))
  if (serverDelivery != null && claimedDelivery + DELIVERY_TOLERANCE_KOBO < serverDelivery) {
    return fail(409, "Delivery pricing has changed. Please refresh the page and try again.")
  }
  const deliveryKobo = serverDelivery != null ? Math.max(serverDelivery, claimedDelivery) : claimedDelivery

  const expectedTotalKobo = breakdown.buyerTotalKobo + deliveryKobo
  if (!Number.isFinite(claimedTotalKobo) || claimedTotalKobo + DELIVERY_TOLERANCE_KOBO < expectedTotalKobo) {
    return fail(409, "The total does not match the current price. Please refresh the page and try again.")
  }

  const safe: Record<string, any> = {
    ...draft,
    sellerId: listing.sellerId,
    itemPrice: itemPriceKobo,
    platformFee: breakdown.commissionKobo,
    sellerPayout: breakdown.sellerPayoutKobo,
    deliveryFee: deliveryKobo,
    totalAmount: expectedTotalKobo,
    lineItems: [{ ...(li ?? {}), listingId: listing.id, qty: effectiveQty }],
    zmxVerified: true,
    isOfferOrder: !!draft.isOfferOrder,
    offerId,
  }
  return { ok: true, draft: safe, expectedTotalKobo }
}

// ── Paid amount ──────────────────────────────────────────────────
// Gateways may add processing fees on top (dashboards are set to "charge
// customer"), so the paid amount must be AT LEAST the expected total.
export function paidCoversTotal(paidKobo: number, expectedKobo: number): boolean {
  return Number.isFinite(paidKobo) && paidKobo + 1 >= expectedKobo
}

// ── Cart verification ────────────────────────────────────────────
export interface PinnedCart {
  totalKobo: number
  // Server-derived, per seller. These — not the client's cartItems — are what
  // order rows are written from, and they travel inside the gateway's own
  // transaction metadata, which the browser cannot alter after initialize.
  groups: Record<string, { subtotalKobo: number; deliveryFeeKobo: number }>
}

export type CartCheck =
  | { ok: true; pinned: PinnedCart }
  | { ok: false; status: number; error: string }

const cartFail = (status: number, error: string): CartCheck => ({ ok: false, status, error })

export async function verifyCartPayment(
  cartItems: any[],
  ctx: { buyerUid: string; claimedTotalKobo: number; buyerState: string; nativeDB?: unknown },
): Promise<CartCheck> {
  const { buyerUid, claimedTotalKobo, buyerState, nativeDB } = ctx
  if (!Array.isArray(cartItems) || cartItems.length === 0) return cartFail(400, "No cart items on payment")

  const groups: PinnedCart["groups"] = {}
  let subtotalAll = 0
  let deliveryAll = 0

  for (const group of cartItems) {
    const lines: any[] = Array.isArray(group?.lineItems) ? group.lineItems : []
    if (lines.length === 0) return cartFail(400, "Cart group has no items")

    let floorGroup = 0
    let firstListing: ServerListing | null = null
    let firstQty = 1
    let sellerId = ""

    for (const line of lines) {
      const listing = await loadServerListing(String(line?.listingId ?? ""), nativeDB)
      if (!listing || listing.status !== "active") return cartFail(409, `${line?.title ?? "An item"} is no longer available.`)
      const qty = Math.max(1, Math.floor(Number(line?.qty ?? 1)) || 1)

      if (listing.minOrderQty && listing.minOrderQty > 1 && qty < listing.minOrderQty) {
        return cartFail(409, `${line?.title ?? "An item"} has a minimum order of ${listing.minOrderQty}.`)
      }
      if (listing.stockQty != null && listing.stockQty < qty) {
        return cartFail(409, `${line?.title ?? "An item"} only has ${listing.stockQty} left in stock.`)
      }

      // Every line in one group must belong to the same seller, and that
      // seller comes from the listing — never from the client payload.
      if (!sellerId) sellerId = listing.sellerId
      else if (sellerId !== listing.sellerId) return cartFail(400, "Cart group mixes sellers")

      if (line?.agreedPrice != null && line?.offerId) {
        const offer = await loadVerifiedOffer(String(line.offerId), buyerUid, listing, nativeDB)
        if (!offer) return cartFail(409, `The offer on ${line?.title ?? "an item"} is no longer valid.`)
        floorGroup += offer.agreedTotalKobo
      } else {
        floorGroup += floorItemTotalKobo(listing, qty, { couponCode: line?.couponCode ?? null })
      }

      if (!firstListing) { firstListing = listing; firstQty = qty }
    }

    const claimedSubtotal = Number(group?.subtotal ?? 0)
    if (!Number.isFinite(claimedSubtotal) || claimedSubtotal < floorGroup) {
      return cartFail(409, "A price in your cart has changed. Please refresh your cart and try again.")
    }

    // Delivery: recomputed only for single-item groups (multi-item weight
    // aggregation is not reproducible here); otherwise the claimed fee stands.
    const claimedDelivery = Math.max(0, Number(group?.deliveryFee ?? 0))
    let deliveryKobo = claimedDelivery
    if (lines.length === 1 && firstListing) {
      const serverDelivery = await computeDeliveryFeeKobo(firstListing, {
        method: String(group?.deliveryMethod ?? "meetup"),
        buyerState,
        qty: firstQty,
        isDoorstep: group?.isDoorstepDelivery !== false,
      }, nativeDB)
      if (serverDelivery != null) {
        if (claimedDelivery + DELIVERY_TOLERANCE_KOBO < serverDelivery) {
          return cartFail(409, "Delivery pricing has changed. Please refresh your cart and try again.")
        }
        deliveryKobo = Math.max(serverDelivery, claimedDelivery)
      }
    }

    groups[sellerId] = { subtotalKobo: Math.round(claimedSubtotal), deliveryFeeKobo: deliveryKobo }
    subtotalAll += Math.round(claimedSubtotal)
    deliveryAll += deliveryKobo
  }

  const fees = await loadServerFees()
  const buyerFee = calculateFees(subtotalAll, "sale", fees).buyerConvenienceKobo
  const totalKobo = subtotalAll + buyerFee + deliveryAll

  if (!Number.isFinite(claimedTotalKobo) || claimedTotalKobo + DELIVERY_TOLERANCE_KOBO < totalKobo) {
    return cartFail(409, "The total does not match the current prices. Please refresh your cart and try again.")
  }
  return { ok: true, pinned: { totalKobo, groups } }
}

// Per-seller order money, derived on the server from a pinned subtotal.
export async function orderMoneyFromSubtotal(subtotalKobo: number) {
  const fees = await loadServerFees()
  const b = calculateFees(subtotalKobo, "sale", fees)
  return { platformFee: b.commissionKobo, sellerPayout: b.sellerPayoutKobo }
}
