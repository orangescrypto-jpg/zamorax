// app/api/admin/listings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

export async function POST(req: NextRequest) {
  const { ok, error, uid } = await requireAdmin(req)
  if (!ok) return error!

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
      listingType,
      condition,
      priceSale,
      priceRentDaily,
      priceRentWeekly,
      depositAmount,
      images,
      verificationVideo,
      attributes,
      nigerianState,
      city,
      deliveryNationwide,
      isFeatured,
      isBoosted,
      boostType,
      boostExpiresAt,
    } = body

    if (!id || !title || !categorySlug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Column names match the camelCase format the D1 table was created with
    // (original Firebase export preserved camelCase; setDoc's snake_case conversion
    //  only applies to docs written via AdminService after migration)
    await d1Query(
      `INSERT OR REPLACE INTO listings (
        id, sellerId, sellerName,
        categorySlug, title, slug, description,
        listingType, condition,
        priceSale, priceRentDaily, priceRentWeekly, depositAmount,
        images, verificationVideo, attributes,
        nigerianState, city, deliveryNationwide,
        isActive, status, approvedBy, approvedAt,
        isFeatured, isBoosted, boostType, boostExpiresAt,
        views, saves, inquiries,
        createdAt, updatedAt
      ) VALUES (
        ?,?,?,
        ?,?,?,?,
        ?,?,
        ?,?,?,?,
        ?,?,?,
        ?,?,?,
        1,'active',?,?,
        ?,?,?,?,
        0,0,0,
        ?,?
      )`,
      [
        id, sellerId ?? uid, sellerName ?? "Zamorax Admin",
        categorySlug, title, slug, description,
        listingType ?? "sale", condition ?? "brand_new",
        priceSale ?? 0, priceRentDaily ?? null, priceRentWeekly ?? null, depositAmount ?? null,
        typeof images === "string" ? images : JSON.stringify(images ?? []),
        verificationVideo ?? null,
        typeof attributes === "string" ? attributes : JSON.stringify(attributes ?? {}),
        nigerianState, city, deliveryNationwide ? 1 : 0,
        uid, now,
        isFeatured ? 1 : 0, isBoosted ? 1 : 0,
        boostType ?? null, boostExpiresAt ?? null,
        now, now,
      ],
    )

    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
