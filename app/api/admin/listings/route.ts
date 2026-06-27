// app/api/admin/listings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

// context.env.DB is provided by Cloudflare Pages (native D1 binding).
// On Vercel it is undefined — d1Query falls back to the HTTP API automatically.
type CFContext = { env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: CFContext = {}) {
  const { ok, error, uid } = await requireAdmin(req)
  if (!ok) return error!

  const nativeDB = context?.env?.DB

  try {
    const body = await req.json()

    const {
      id,
      sellerId,
      sellerName,
      categorySlug,
      title,
      description,
      condition,
      priceSale,
      images,
      nigerianState,
      isBoosted,
      boostExpiresAt,
    } = body

    if (!id || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Columns verified via: PRAGMA table_info(listings)
    // id, seller_id, seller_name, seller_state, title, description,
    // price, category, condition, images, status, is_boosted,
    // boost_expires_at, ad_boost_status, stock_qty, weight_kg,
    // is_fragile, delivery_options, views, created_at, updated_at
    await d1Query(
      `INSERT OR REPLACE INTO listings (
        id, seller_id, seller_name, seller_state,
        title, description,
        price, category, condition,
        images,
        status, is_boosted, boost_expires_at,
        views, created_at, updated_at
      ) VALUES (
        ?,?,?,?,
        ?,?,
        ?,?,?,
        ?,
        'active',?,?,
        0,?,?
      )`,
      [
        id,
        sellerId ?? uid,
        sellerName ?? "Zamorax Admin",
        nigerianState ?? null,
        title,
        description ?? null,
        priceSale ?? 0,
        categorySlug ?? null,
        condition ?? "brand_new",
        typeof images === "string" ? images : JSON.stringify(images ?? []),
        isBoosted ? 1 : 0,
        boostExpiresAt ?? null,
        now,
        now,
      ],
      nativeDB, // undefined on Vercel → HTTP API; env.DB on CF Pages → native binding
    )

    return NextResponse.json({ success: true, id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
