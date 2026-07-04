// app/api/listings/route.ts
// Public endpoint — no auth required.
// Filters by status = 'active' only. is_active does not exist in D1 schema.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const PAGE_SIZE = 20

function rowToListing(row: Record<string, unknown>) {
  const parse = (v: unknown) => {
    if (!v) return undefined
    try { return JSON.parse(v as string) } catch { return v }
  }
  return {
    id:                 String(row.id),
    sellerId:           String(row.seller_id        ?? ""),
    categoryId:         String(row.category_id      ?? ""),
    categorySlug:       String(row.category         ?? row.category_slug ?? ""),
    title:              String(row.title            ?? ""),
    slug:               String(row.slug             ?? row.id ?? ""),
    description:        String(row.description      ?? ""),
    listingType:        String(row.listing_type     ?? "sale"),
    condition:          (["brand_new", "open_box", "grade_a", "grade_b"].includes(String(row.condition)) ? String(row.condition) : "grade_a"),
    priceSale:          Number(row.price            ?? row.price_sale ?? 0),
    priceRentDaily:     row.price_rent_day          ? Number(row.price_rent_day)   : undefined,
    priceRentWeekly:    row.price_rent_week         ? Number(row.price_rent_week)  : undefined,
    depositAmount:      row.deposit_amount          ? Number(row.deposit_amount)   : undefined,
    images:             parse(row.images)           ?? [],
    verificationVideo:  row.verification_video      ? String(row.verification_video) : undefined,
    attributes:         parse(row.attributes)       ?? {},
    isHubVerified:      !!row.is_hub_verified,
    isActive:           true, // derived from status === 'active'
    isBoosted:          !!row.is_boosted,
    boostType:          String(row.boost_type       ?? "none"),
    boostExpiresAt:     row.boost_expires_at        ? String(row.boost_expires_at) : undefined,
    status:             String(row.status           ?? "pending"),
    rejectionReason:    row.rejection_reason        ? String(row.rejection_reason) : undefined,
    nigerianState:      String(row.nigerian_state   ?? row.seller_state ?? ""),
    city:               String(row.city             ?? ""),
    deliveryNationwide: !!row.delivery_nationwide,
    weightKg:           row.weight_kg               ? Number(row.weight_kg)        : undefined,
    isFragile:          row.is_fragile              ? !!row.is_fragile             : undefined,
    shippingMethods:    parse(row.delivery_options  ?? row.shipping_methods)       ?? undefined,
    stockQty:           row.stock_qty != null       ? Number(row.stock_qty)        : undefined,
    views:              Number(row.views            ?? 0),
    saves:              Number(row.saves            ?? 0),
    inquiries:          Number(row.inquiries        ?? 0),
    sellerName:         row.seller_name             ? String(row.seller_name)      : undefined,
    sellerPlan:         row.seller_plan             ? String(row.seller_plan)      : undefined,
    sellerRating:       row.seller_rating           ? Number(row.seller_rating)    : undefined,
    sellerVerified:     row.seller_verified         ? !!row.seller_verified        : undefined,
    flashDeal:          parse(row.flash_deal)       ?? null,
    vacationMode:       row.vacation_mode           ? !!row.vacation_mode          : undefined,
    vacationReturnDate: row.vacation_return_date    ? String(row.vacation_return_date) : undefined,
    createdAt:          String(row.created_at       ?? new Date().toISOString()),
    updatedAt:          String(row.updated_at       ?? new Date().toISOString()),
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const { searchParams } = req.nextUrl

  const category      = searchParams.get("category")      ?? undefined
  const listingType   = searchParams.get("listingType")   ?? undefined
  const condition     = searchParams.get("condition")     ?? undefined
  const nigerianState = searchParams.get("nigerianState") ?? undefined
  const verified      = searchParams.get("verified") === "true"
  const minPrice      = searchParams.get("minPrice")  ? Number(searchParams.get("minPrice"))  : undefined
  const maxPrice      = searchParams.get("maxPrice")  ? Number(searchParams.get("maxPrice"))  : undefined
  const q             = searchParams.get("q")             ?? undefined
  const sellerId      = searchParams.get("sellerId")      ?? undefined
  const cursor        = searchParams.get("cursor")        ?? undefined
  const limitParam    = searchParams.get("limit")
                          ? Math.min(Number(searchParams.get("limit")), PAGE_SIZE)
                          : PAGE_SIZE

  // status is the only active/inactive flag in D1 — is_active does not exist
  const conditions: string[] = ["status = 'active'"]
  const params: unknown[] = []

  if (category)      { conditions.push("category = ?");        params.push(category) }
  if (listingType)   { conditions.push("listing_type = ?");    params.push(listingType) }
  if (condition)     { conditions.push("condition = ?");       params.push(condition) }
  if (nigerianState) { conditions.push("seller_state = ?");    params.push(nigerianState) }
  if (verified)      { conditions.push("seller_verified = 1") }
  if (minPrice !== undefined) { conditions.push("price >= ?"); params.push(minPrice) }
  if (maxPrice !== undefined) { conditions.push("price <= ?"); params.push(maxPrice) }
  if (q)             { conditions.push("title LIKE ?");        params.push(`%${q}%`) }
  if (sellerId)      { conditions.push("seller_id = ?");       params.push(sellerId) }
  if (cursor)        { conditions.push("created_at < ?");      params.push(cursor) }

  const where = conditions.join(" AND ")
  const sql = `
    SELECT * FROM listings
    WHERE ${where}
    ORDER BY is_boosted DESC, created_at DESC
    LIMIT ${limitParam + 1}
  `

  try {
    const result = await d1Query(sql, params, nativeDB)
    const rows = ((result as any)?.results ?? result ?? []) as Record<string, unknown>[]
    const hasMore = rows.length > limitParam
    const page = rows.slice(0, limitParam).map(rowToListing)
    const nextCursor = hasMore ? page[page.length - 1]?.createdAt ?? null : null

    return NextResponse.json({ items: page, nextCursor, hasMore })
  } catch (err: any) {
    console.error("[/api/listings]", err)
    return NextResponse.json({ items: [], nextCursor: null, hasMore: false })
  }
}
