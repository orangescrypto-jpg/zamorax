// app/api/listings/featured/route.ts
// Public endpoint — no auth required. Returns boosted active listings for homepage.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function rowToListing(row: Record<string, unknown>) {
  let images: string[] = []
  try { images = JSON.parse(row.images as string ?? "[]") } catch { images = [] }

  let flashDeal: Record<string, unknown> | null = null
  try { flashDeal = row.flash_deal ? JSON.parse(row.flash_deal as string) : null } catch { flashDeal = null }

  const coupon = row.coupon_enabled && row.coupon_code
    ? { code: String(row.coupon_code), discountPercent: Number(row.coupon_discount_percent ?? 0) }
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
    isFeatured:     !!row.is_boosted,
    boostEndsAt:    row.boost_expires_at,
    flashDeal,
    isFlashDeal:    !!row.is_flash_deal,
    coupon,
    nigerianState:  row.nigerian_state,
    city:           row.city,
    views:          Number(row.views) || 0,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const now = new Date().toISOString()

  try {
    const rows = await d1Query(
      `SELECT * FROM listings
       WHERE status = 'active'
         AND is_boosted = 1
         AND (boost_expires_at IS NULL OR boost_expires_at > ?)
       ORDER BY boost_expires_at DESC
       LIMIT 8`,
      [now],
      nativeDB,
    )

    const listings = ((rows as any)?.results ?? []).map((r: any) => rowToListing(r))
    return NextResponse.json({ listings })
  } catch (err: any) {
    console.error("[listings/featured]", err)
    return NextResponse.json({ listings: [] })
  }
}
