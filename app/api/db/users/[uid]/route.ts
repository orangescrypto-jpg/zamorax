// app/api/db/users/[uid]/route.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIRESTORE → NOW CLOUDFLARE D1
// GET  /api/db/users/:uid  — fetch user profile
// PATCH /api/db/users/:uid — update user profile
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"

async function d1Query(sql: string, params: unknown[] = []) {
  const accountId  = process.env.CF_ACCOUNT_ID
  const databaseId = process.env.CF_D1_DATABASE_ID
  const apiToken   = process.env.CF_API_TOKEN

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "D1 is not configured: missing CF_ACCOUNT_ID, CF_D1_DATABASE_ID, or " +
      "CF_API_TOKEN. Set these in your hosting provider's environment " +
      "variables (e.g. Vercel → Settings → Environment Variables) and redeploy.",
    )
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ sql, params }),
    },
  )
  const json = await res.json() as any
  if (!json.success) throw new Error(json.errors?.[0]?.message ?? "D1 error")
  return json.result?.[0]
}

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
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await params
    const result = await d1Query(
      "SELECT * FROM users WHERE uid = ? LIMIT 1",
      [uid],
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await params
    const data = await req.json()
    const now  = new Date().toISOString()

    // Build SET clause dynamically from allowed fields
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
        // Booleans → 0/1 for SQLite
        vals.push(typeof data[jsKey] === "boolean" ? (data[jsKey] ? 1 : 0) : data[jsKey])
      }
    }

    vals.push(uid)

    await d1Query(
      `UPDATE users SET ${sets.join(", ")} WHERE uid = ?`,
      vals,
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[PATCH /api/db/users/:uid]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Unknown server error" },
      { status: 500 },
    )
  }
}
