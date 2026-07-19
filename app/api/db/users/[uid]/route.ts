// app/api/db/users/[uid]/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { requireAdmin } from "@/lib/auth-server"

// Merges Next.js required context shape with Cloudflare Pages env binding.
// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<{ uid: string }>; env?: { DB?: unknown } }

function mapRow(row: Record<string, unknown>) {
  if (!row) return null
  return {
    uid:               row.uid,
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
    activeListingCount: row.active_listing_count,
    sellerRating:      row.seller_rating,
    totalSales:        row.total_sales,
    totalRentals:      row.total_rentals,
    isSellerReady:     !!row.is_seller_ready,
    profilePhoto:      row.profile_photo,
    storeName:         row.store_name,
    storeDescription:  row.store_description,
    isOfficial:        !!row.is_official,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  }
}

// GET /api/db/users/:uid — full raw profile including PII and
// verification/ban status. Admin-only (e.g. /admin/settings user lookup).
// Regular users should fetch their own profile through the scoped
// buyer/seller "settings" routes, not this one.
export async function GET(
  req: NextRequest,
  context: RouteContext,
) {
  const nativeDB = (context as any)?.env?.DB
  const { uid } = await context.params

  // Any authenticated user may fetch their own profile.
  // Fetching another user's profile requires admin.
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  const { data: { user: sessionUser } } = await supabase.auth.getUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (sessionUser.id !== uid) {
    const auth = await requireAdmin(req, nativeDB)
    if (!auth.ok) return auth.error
  }

  try {
    const result = await d1Query(
      "SELECT * FROM users WHERE uid = ? LIMIT 1",
      [uid],
      nativeDB,
    )
    const row = result?.results?.[0]
    if (!row) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(mapRow(row))
  } catch (err) {
    console.error("[GET /api/db/users/:uid]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Unknown server error" },
      { status: 500 },
    )
  }
}

// PATCH /api/db/users/:uid — admin-only. This allows writes to role,
// plan, ban status, and verification flags, none of which should ever
// be settable by an unauthenticated or non-admin caller. Self-service
// profile edits (name, photo, store info) should go through the
// buyer/seller "settings" routes instead, which are scoped to the
// caller's own uid and don't expose these privileged fields.
export async function PATCH(
  req: NextRequest,
  context: RouteContext,
) {
  const nativeDB = (context as any)?.env?.DB

  const auth = await requireAdmin(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const { uid } = await context.params
    const data = await req.json()
    const now  = new Date().toISOString()

    const fieldMap: Record<string, string> = {
      fullName:          "full_name",
      username:          "username",
      phone:             "phone",
      profilePhoto:      "profile_photo",
      storeName:         "store_name",
      storeDescription:  "store_description",
      role:              "role",
      plan:              "plan",
      planExpiresAt:     "plan_expires_at",
      verificationLevel: "verification_level",
      ninVerified:       "nin_verified",
      bvnVerified:       "bvn_verified",
      phoneVerified:     "phone_verified",
      emailVerified:     "email_verified",
      isBanned:          "is_banned",
      banReason:         "ban_reason",
      isSellerReady:     "is_seller_ready",
      isOfficial:        "is_official",
      fcmToken:          "fcm_token",
      activeListingCount: "active_listing_count",
      sellerRating:      "seller_rating",
      totalSales:        "total_sales",
      totalRentals:      "total_rentals",
    }

    const sets: string[] = ["updated_at = ?"]
    const vals: unknown[] = [now]

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (jsKey in data) {
        sets.push(`${dbCol} = ?`)
        vals.push(typeof data[jsKey] === "boolean" ? (data[jsKey] ? 1 : 0) : data[jsKey])
      }
    }

    vals.push(uid)

    await d1Query(
      `UPDATE users SET ${sets.join(", ")} WHERE uid = ?`,
      vals,
      nativeDB,
    )

    // Marking/unmarking a seller "official" retroactively pulls their
    // existing active listings into/out of Zamorax Direct too, not just
    // future ones — reuses the exact same is_zamorax_pick mechanism as
    // the individual per-listing pick/unpick action in
    // /api/admin/manage-listings, so behavior (removed from normal
    // search/store while picked) is identical either way.
    if ("isOfficial" in data) {
      await d1Query(
        "UPDATE listings SET is_zamorax_pick = ?, updated_at = ? WHERE seller_id = ? AND status = 'active'",
        [data.isOfficial ? 1 : 0, now, uid],
        nativeDB,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[PATCH /api/db/users/:uid]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Unknown server error" },
      { status: 500 },
    )
  }
}
