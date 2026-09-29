// app/api/listings/flash-deals/route.ts
// Public endpoint — no auth required. Returns active listings that currently
// have a live seller flash deal (flash_deal JSON with a future expiresAt).
// Used by the homepage "Flash Sale" row and the full /flash-deals page.
// (The old client-side query filtered on listings.is_active, a column that
// does not exist in D1 — listings use `status` — so it always came back empty.)
//   ?limit=N   cap results (default 24, max 100)
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function rowToListing(row: Record<string, unknown>) {
  let images: string[] = []
  try { images = JSON.parse(row.images as string ?? "[]") } catch { images = [] }

  let flashDeal: Record<string, unknown> | null = null
  try { flashDeal = row.flash_deal ? JSON.parse(row.flash_deal as string) : null } catch { flashDeal = null }

  let bulkPricing: { minQty: number; price: number }[] | null = null
  try { bulkPricing = row.bulk_pricing ? JSON.parse(row.bulk_pricing as string) : null } catch { bulkPricing = null }

  const coupon = row.coupon_enabled && row.coupon_code
    ? { code: String(row.coupon_code), discountPercent: Number(row.coupon_discount_percent ?? 0) }
    : null

  const standingDiscount = row.standing_discount_enabled && row.standing_discount_percent
    ? { discountPercent: Number(row.standing_discount_percent ?? 0), applyToBulk: !!row.standing_discount_apply_to_bulk }
    : null

  return {
    id:             row.id,
    sellerId:       row.seller_id,
    sellerName:     row.seller_name,
    title:          row.title,
    description:    row.description,
    priceSale:      Number(row.price) || 0,
    categorySlug:   row.category,
    condition:      row.condition,
    listingType:    row.listing_type || "sale",
    priceRentDaily: row.price_rent_day != null ? Number(row.price_rent_day) : undefined,
    images,
    status:         row.status,
    isBoosted:      !!row.is_boosted,
    isFBZ:          !!row.is_fbz,
    isHubVerified:  !!row.is_hub_verified,
    deliveryFeeOverrideKobo: row.delivery_fee_override_kobo != null ? Number(row.delivery_fee_override_kobo) : null,
    estimatedDeliveryDays: row.estimated_delivery_days ? String(row.estimated_delivery_days) : undefined,
    isOfficial:     !!row.is_official_seller || !!row.is_zamorax_pick,
    isZamoraxPick:  !!row.is_zamorax_pick,
    flashDeal,
    isFlashDeal:    !!row.is_flash_deal,
    bulkPricing,
    minOrderQty:    row.min_order_qty != null ? Number(row.min_order_qty) : null,
    unitOfSale:     row.unit_of_sale ? String(row.unit_of_sale) : null,
    offersEnabled:  row.offers_enabled == null ? true : !!row.offers_enabled,
    coupon,
    standingDiscount,
    nigerianState:  row.nigerian_state,
    city:           row.city,
    views:          Number(row.views) || 0,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const { searchParams } = new URL(req.url)
  const limitParam = Number(searchParams.get("limit"))
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 24

  try {
    const rows = await d1Query(
      `SELECT l.*, u.is_official AS is_official_seller FROM listings l
       JOIN users u ON u.uid = l.seller_id
       WHERE l.status = 'active' AND l.flash_deal IS NOT NULL
       ORDER BY l.created_at DESC
       LIMIT 200`,
      [],
      nativeDB,
    )
    const now = Date.now()
    const listings = ((rows as any)?.results ?? [])
      .map((r: any) => rowToListing(r))
      .filter((l: any) => {
        const fd = l.flashDeal as any
        if (!fd?.expiresAt || !(fd.discountPercent > 0)) return false
        return new Date(fd.expiresAt).getTime() > now
      })
      .slice(0, limit)
    return NextResponse.json({ listings })
  } catch (err: any) {
    console.error("[listings/flash-deals]", err)
    return NextResponse.json({ listings: [], _debugError: err?.message ?? String(err) })
  }
}
