import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format price in Naira — always use kobo internally
export interface BulkTier {
  minQty: number
  price: number
}

export interface ResolvedBulkPrice {
  total: number        // kobo — resolved TOTAL for the given quantity
  isExactTier: boolean
}

// Shared bulk-tier resolver — used by both the listing page (initial add-to-cart)
// and the cart drawer (re-resolving on every quantity change), so a buyer never
// sees two different totals for the same listing/quantity depending on where
// they changed it.
//
// FIX: bulkPricing[i].price is a PER-PIECE rate, not a flat bundle total —
// this matches how the seller-facing form displays and validates it
// (Step7Review shows "≥12 pieces ₦4,500.00" as a per-piece figure, and the
// zod schema in lib/validations/listing.ts requires each tier's `price` to
// be less than the base per-piece priceSale). This function previously
// treated an exact minQty match as a flat total and divided it back down
// to an implied per-piece rate — e.g. a seller-entered ₦4,320/piece tier
// at minQty 12 was charged to buyers as ₦4,320 total (₦360/piece), a ~12x
// undercharge. Tiers are always priced per piece and multiplied by qty.
//
// Below the first tier's minQty → qty × basePriceSale.
// At or above a tier's minQty → qty × that tier's per-piece price, using
// the highest minQty tier the quantity has reached or passed.
// Returns null when there's no bulk pricing at all, so callers fall back
// to plain base-price × qty.
//
// flashDiscountPercent (0-100), when provided, discounts every tier by the
// same percentage as the 1-piece flash price, keeping the whole price
// ladder consistent. Tiers are scaled at read time only — the stored
// bulkPricing data itself is never mutated.
export function resolveBulkPrice(
  bulkPricing: BulkTier[] | null | undefined,
  basePriceSale: number,
  quantity: number,
  flashDiscountPercent?: number | null
): ResolvedBulkPrice | null {
  if (!bulkPricing || bulkPricing.length === 0) return null

  const scale = (price: number) =>
    flashDiscountPercent ? Math.round(price * (1 - flashDiscountPercent / 100)) : price

  const tiers = [...bulkPricing]
    .sort((a, b) => a.minQty - b.minQty)
    .map((t) => ({ minQty: t.minQty, price: scale(t.price) }))

  const reached = tiers.filter((t) => quantity >= t.minQty)
  if (reached.length === 0) return null // below first tier — caller uses base price × qty

  const applicableTier = reached[reached.length - 1]
  return {
    total: Math.round(applicableTier.price * quantity),
    isExactTier: applicableTier.minQty === quantity,
  }
}

export function formatPrice(kobo: number): string {
  const naira = kobo / 100
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira)
}

// Format price with unit suffix for unit-bearing categories (groceries,
// agricultural, building materials — e.g. "₦45,000.00 / bag"). Pass
// listing.attributes?.unit; falsy/empty values render with no suffix so
// this is safe to call for every listing regardless of category.
export function formatPriceWithUnit(kobo: number, unit?: string | null): string {
  const base = formatPrice(kobo)
  // "piece" is the default for single-item listings — showing "/ piece" on
  // every price would be noise. Bulk-goods units (bag, carton, kg, etc.)
  // are the ones that actually help buyers understand what they're paying
  // for.
  if (!unit || unit === "piece") return base
  // Attribute values look like "Per kg", "Per bag (50kg)", "Bags", "Tonnes" —
  // normalize to a short trailing suffix like "/ kg" or "/ bag (50kg)".
  const cleaned = unit.replace(/^per\s+/i, "").trim()
  if (!cleaned) return base
  return `${base} / ${cleaned}`
}

// Truncate text for listing titles
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

// Generate slug from title
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

// Debounce — delays invoking fn until after wait ms have elapsed
// since the last time it was called. Used for search inputs etc.
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
      timer = null
    }, wait)
  }
}
