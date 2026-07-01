// app/api/seller/[uid]/route.ts
// Public endpoint — returns safe seller fields only (no PII).
// No auth required so listing pages can show seller info to all visitors.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<{ uid: string }>; env?: { DB?: unknown } }

export async function GET(_req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const { uid } = await context.params
  try {
    const result = await d1Query(
      `SELECT uid, full_name, store_name, store_description, profile_photo,
              seller_rating, total_sales, total_rentals, nin_verified, bvn_verified,
              plan, is_seller_ready, created_at
       FROM users WHERE uid = ? LIMIT 1`,
      [uid],
      nativeDB,
    )
    const row = (result as any)?.results?.[0]
    if (!row) return NextResponse.json(null, { status: 404 })
    return NextResponse.json({
      id:               row.uid,
      uid:              row.uid,
      fullName:         row.full_name,
      storeName:        row.store_name,
      storeDescription: row.store_description,
      profilePhoto:     row.profile_photo,
      sellerRating:     row.seller_rating ?? 0,
      totalSales:       row.total_sales ?? 0,
      totalRentals:     row.total_rentals ?? 0,
      ninVerified:      !!row.nin_verified,
      bvnVerified:      !!row.bvn_verified,
      plan:             row.plan,
      isSellerReady:    !!row.is_seller_ready,
    })
  } catch (err) {
    console.error("[GET /api/seller/:uid]", err)
    return NextResponse.json({ error: "Failed to fetch seller" }, { status: 500 })
  }
}
