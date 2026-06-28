// app/api/auth/me/route.ts  — REPLACE EXISTING FILE
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function rowToProfile(row: Record<string, unknown>) {
  return {
    id:                row.uid ?? row.id,
    uid:               row.uid ?? row.id,
    email:             row.email,
    phone:             row.phone,
    fullName:          row.full_name,
    username:          row.username,
    role:              row.role,
    plan:              row.plan,
    planExpiresAt:     row.plan_expires_at,
    verificationLevel: row.verification_level,
    ninVerified:       !!row.nin_verified,
    bvnVerified:       !!row.bvn_verified,
    phoneVerified:     !!row.phone_verified,
    emailVerified:     !!row.email_verified,
    isBanned:          !!row.is_banned,
    banReason:         row.ban_reason,
    profilePhoto:      row.profile_photo,
    storeName:         row.store_name,
    storeDescription:  row.store_description,
    isSellerReady:     !!row.is_seller_ready,
    activeListingCount: row.active_listing_count,
    sellerRating:      row.seller_rating,
    totalSales:        row.total_sales,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll() {},
        },
      },
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: "No session" }, { status: 401 })
    }

    const result = await d1Query(
      "SELECT * FROM users WHERE uid = ? LIMIT 1",
      [user.id],
      nativeDB,
    )
    const row = (result as any)?.results?.[0]
    if (!row) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ profile: rowToProfile(row) })
  } catch (err: any) {
    console.error("[GET /api/auth/me]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
