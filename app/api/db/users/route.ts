// app/api/db/users/route.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIRESTORE → NOW CLOUDFLARE D1
// User profile CRUD via Neon/Turso/D1 depending on host.
// For Vercel testing: uses Cloudflare D1 REST API (HTTP).
// For Cloudflare Pages prod: env.DB binding (native).
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function getAuthUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7)
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// ── Cloudflare D1 HTTP helper (works on Vercel too) ──────────────
async function d1Query(sql: string, params: unknown[] = []) {
  const accountId  = process.env.CF_ACCOUNT_ID
  const databaseId = process.env.CF_D1_DATABASE_ID
  const apiToken   = process.env.CF_API_TOKEN

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "D1 misconfigured: CF_ACCOUNT_ID, CF_D1_DATABASE_ID and CF_API_TOKEN must all be set in Vercel environment variables.",
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
  if (!json.success) throw new Error(json.errors?.[0]?.message ?? "D1 query failed")
  return json.result?.[0]
}

// POST /api/db/users — create user profile
export async function POST(req: NextRequest) {
  try {
  const data = await req.json()

  await d1Query(
    `INSERT INTO users (
      uid, email, phone, full_name, username, role, plan, plan_expires_at,
      verification_level, nin_verified, bvn_verified, phone_verified,
      email_verified, is_banned, active_listing_count, seller_rating,
      total_sales, total_rentals, is_seller_ready, profile_photo,
      store_name, store_description, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(uid) DO NOTHING`,
    [
      data.uid,
      data.email,
      data.phone ?? null,
      data.fullName,
      data.username ?? null,
      data.role ?? "buyer",
      data.plan ?? "free",
      data.planExpiresAt ?? null,
      data.verificationLevel ?? "none",
      data.ninVerified   ? 1 : 0,
      data.bvnVerified   ? 1 : 0,
      data.phoneVerified ? 1 : 0,
      data.emailVerified ? 1 : 0,
      data.isBanned      ? 1 : 0,
      data.activeListingCount ?? 0,
      data.sellerRating  ?? 0,
      data.totalSales    ?? 0,
      data.totalRentals  ?? 0,
      data.isSellerReady ? 1 : 0,
      data.profilePhoto  ?? null,
      data.storeName     ?? null,
      data.storeDescription ?? null,
      data.createdAt ?? new Date().toISOString(),
      data.updatedAt ?? new Date().toISOString(),
    ],
  )

  return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[POST /api/db/users]", err?.message)
    return NextResponse.json({ error: err?.message ?? "Internal server error" }, { status: 500 })
  }
}
