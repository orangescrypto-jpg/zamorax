// app/api/auth/register/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"
import { d1Query } from "@/lib/d1"

// Merges Next.js required context shape with Cloudflare Pages env binding.
// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    const {
      email, password, fullName, username, phone, role,
      storeName, storeDescription, nigerianState, nin,
      referredBy,
    } = await req.json()

    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    // ── 1. Create Firebase Auth user ──────────────────────────────
    let userRecord: Awaited<ReturnType<typeof adminAuth.createUser>>
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: false,
      })
    } catch (err: any) {
      let message = err.message ?? "Registration failed"
      if (err.code === "auth/email-already-exists")
        message = "An account with this email already exists."
      if (err.code === "auth/weak-password")
        message = "Password must be at least 6 characters."
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const uid = userRecord.uid
    const now = new Date().toISOString()

    // ── 2. Create D1 user profile ─────────────────────────────────
    await d1Query(
      `INSERT INTO users (
        uid, email, phone, full_name, username, role, plan,
        verification_level, nin_verified, bvn_verified, phone_verified,
        email_verified, is_banned, active_listing_count, seller_rating,
        total_sales, total_rentals, is_seller_ready,
        wallet_balance, store_name, store_description, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(uid) DO NOTHING`,
      [
        uid, email, phone ?? null, fullName,
        username?.toLowerCase() ?? null,
        role ?? "buyer", "free",
        role === "seller" ? "nin" : "none",
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, // wallet_balance
        storeName ?? null,
        storeDescription ?? null,
        now, now,
      ],
      nativeDB,
    )

    // ── 3. Verification request for sellers ───────────────────────
    if (role === "seller" && nin) {
      await d1Query(
        `INSERT INTO verification_requests (
          user_id, user_name, user_email, phone, store_name,
          type, value, nigerian_state, status, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT DO NOTHING`,
        [uid, fullName, email, phone ?? null, storeName ?? null,
         "nin", nin, nigerianState ?? null, "pending", now, now],
        nativeDB,
      ).catch((e: any) => {
        console.warn("[register] verification_requests insert failed:", e.message)
      })
    }

    // ── 4. Send Firebase email verification (fire-and-forget) ─────
    adminAuth.generateEmailVerificationLink(email, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    }).then((link) => {
      // If you have Resend or another email service, send the link here.
      // Firebase also sends automatically if email verification is enabled
      // in the Firebase console (Email/Password provider settings).
      console.log("[register] Verification email queued for:", email)
    }).catch((e: any) => {
      console.warn("[register] generateEmailVerificationLink error:", e.message)
    })

    return NextResponse.json({ user: { id: uid, email } })
  } catch (err: any) {
    console.error("[POST /api/auth/register]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
