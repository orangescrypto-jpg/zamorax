// app/api/db/users/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { requireAdmin } from "@/lib/auth-server"

// Merges Next.js required context shape with Cloudflare Pages env binding.
// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

// GET /api/db/users?username=xxx — full raw user row (email, phone,
// NIN/BVN verification, ban status, etc). Admin-only: there is no
// legitimate non-admin use of this lookup. Public profile data should
// be served from a separate, explicitly-scoped public route instead.
export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  const auth = await requireAdmin(req, nativeDB)
  if (!auth.ok) return auth.error

  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")

  if (!username) return NextResponse.json({ error: "username param required" }, { status: 400 })

  try {
    const result = await d1Query(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username.toLowerCase()],
      nativeDB,
    )
    const row = (result as any)?.results?.[0]
    if (!row) return NextResponse.json(null, { status: 404 })
    return NextResponse.json(row)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/db/users — create user profile. Admin-only.
//
// Real user registration should create the row via the auth/register
// flow with safe server-side defaults (role: "buyer", no verification
// flags set) — not by accepting an arbitrary role/plan/verification
// payload from the client, which would let anyone self-promote to
// admin or fabricate NIN/BVN verification on signup.
export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  const auth = await requireAdmin(req, nativeDB)
  if (!auth.ok) return auth.error

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
      nativeDB,
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/db/users]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Unknown server error" },
      { status: 500 },
    )
  }
}
