// app/api/db/users/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

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
  } catch (err) {
    console.error("[POST /api/db/users]", err)
    return NextResponse.json(
      { error: (err as Error).message ?? "Unknown server error" },
      { status: 500 },
    )
  }
}
