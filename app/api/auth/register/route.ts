// app/api/auth/register/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getAdminAuth } from "@/lib/firebase/admin"
import { d1Query } from "@/lib/d1"

export async function POST(req: NextRequest) {
  try {
    const {
      email, password, fullName, username, phone, role,
      storeName, storeDescription, nigerianState, nin,
      referredBy,
    } = await req.json()

    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    // ── 1. Create Firebase auth user (Admin SDK — no rate limits) ──
    let uid: string
    try {
      const userRecord = await getAdminAuth().createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: false,
      })
      uid = userRecord.uid
    } catch (err: any) {
      const code = err.code ?? ""
      let message = err.message ?? "Registration failed"
      if (code === "auth/email-already-exists") message = "An account with this email already exists."
      if (code === "auth/invalid-email")         message = "Invalid email address."
      if (code === "auth/weak-password")          message = "Password must be at least 6 characters."
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const now = new Date().toISOString()

    // ── 2. Create D1 user profile ──────────────────────────────────
    await d1Query(
      `INSERT INTO users (
        uid, email, phone, full_name, username, role, plan,
        verification_level, nin_verified, bvn_verified, phone_verified,
        email_verified, is_banned, active_listing_count, seller_rating,
        total_sales, total_rentals, is_seller_ready,
        store_name, store_description, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(uid) DO NOTHING`,
      [
        uid, email, phone ?? null, fullName,
        username?.toLowerCase() ?? null,
        role ?? "buyer", "free",
        role === "seller" ? "nin" : "none",
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        storeName ?? null,
        storeDescription ?? null,
        now, now,
      ],
    )

    // ── 3. Verification request for sellers ───────────────────────
    if (role === "seller" && nin) {
      await d1Query(
        `INSERT INTO verification_requests (
          user_id, user_name, user_email, phone, store_name,
          type, value, nigerian_state, status, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT DO NOTHING`,
        [uid, fullName, email, phone ?? null, storeName ?? null,
         "nin", nin, nigerianState ?? null, "pending", now],
      ).catch((e: any) => {
        console.warn("[register] verification_requests insert failed:", e.message)
      })
    }

    // ── 4. Send email verification link ───────────────────────────
    // Fire-and-forget; don't block registration if this fails
    getAdminAuth().generateEmailVerificationLink(email, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    }).then((link: string) => {
      // If you have an email service (Resend etc.) send the link here.
      // For now, Firebase sends the verification email automatically
      // when emailVerified=false and you call sendEmailVerification on the client.
      console.log("[register] Email verification link generated for:", email)
    }).catch((e: any) => {
      console.warn("[register] generateEmailVerificationLink failed:", e.message)
    })

    return NextResponse.json({
      user: { id: uid, email },
    })
  } catch (err: any) {
    console.error("[POST /api/auth/register]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
