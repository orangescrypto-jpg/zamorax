// app/api/admin/listings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const { ok, error, uid } = await requireAdmin(req)
  if (!ok) return error!

  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()

    const {
      id,
      sellerId,
      sellerName,
      categorySlug,
      title,
      slug,
      description,
      condition,
      priceSale,
      images,
      nigerianState,
      city,
      isBoosted,
      boostExpiresAt,
      isFeatured,
      boostType,
      listingType,
      deliveryNationwide,
      attributes,
      verificationVideo,
      priceRentDaily,
      priceRentWeekly,
      depositAmount,
      stockQty,
    } = body

    if (!id || !title) {
      return NextResponse.json({ error: "Missing required fields: id and title" }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Use provided slug or generate from title
    const listingSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    await d1Query(
      `INSERT OR REPLACE INTO listings (
        id, seller_id, seller_name, seller_state, city,
        title, slug, description,
        price, category, condition, listing_type,
        images,
        attributes, verification_video,
        price_rent_day, price_rent_week, deposit_amount,
        stock_qty, delivery_nationwide,
        status, is_boosted, boost_expires_at, boost_type,
        is_featured,
        views, created_at, updated_at
      ) VALUES (
        ?,?,?,?,?,
        ?,?,?,
        ?,?,?,?,
        ?,
        ?,?,
        ?,?,?,
        ?,?,
        'active',?,?,?,
        ?,
        0,?,?
      )`,
      [
        id,
        sellerId ?? uid,
        sellerName ?? "Zamorax Admin",
        nigerianState ?? null,
        city ?? null,
        title,
        listingSlug,
        description ?? null,
        priceSale ?? 0,
        categorySlug ?? null,
        condition ?? "brand_new",
        listingType ?? "sale",
        typeof images === "string" ? images : JSON.stringify(images ?? []),
        attributes ? JSON.stringify(attributes) : "{}",
        verificationVideo ?? null,
        priceRentDaily ?? null,
        priceRentWeekly ?? null,
        depositAmount ?? null,
        stockQty ?? null,
        deliveryNationwide ? 1 : 0,
        isBoosted ? 1 : 0,
        boostExpiresAt ?? null,
        boostType ?? null,
        isFeatured ? 1 : 0,
        now,
        now,
      ],
      nativeDB,
    )

    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    console.error("[admin/listings POST]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
