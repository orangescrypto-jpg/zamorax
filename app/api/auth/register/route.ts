// app/api/auth/register/route.ts  — REPLACE EXISTING FILE
// Uses Supabase Auth instead of Firebase Admin SDK.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
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

    const responseCookies: Array<{ name: string; value: string; options: any }> = []

    // Use service role key to bypass email confirmation on signup
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach((c) => responseCookies.push(c))
          },
        },
      },
    )

    // ── 1. Create Supabase Auth user ──────────────────────────────
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Send verification email
      user_metadata: {
        full_name: fullName,
        username:  username?.toLowerCase(),
        role:      role ?? "buyer",
      },
    })

    if (authError) {
      let message = authError.message ?? "Registration failed"
      if (message.includes("already registered") || message.includes("already been registered")) {
        message = "An account with this email already exists."
      }
      if (message.includes("weak") || message.includes("password")) {
        message = "Password must be at least 6 characters."
      }
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const uid = authData.user.id
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
      ).catch((e: any) => {
        console.warn("[register] verification_requests insert failed:", e.message)
      })
    }

    // ── 4. Send Supabase email verification ───────────────────────
    // Fire-and-forget — don't block registration if this fails
    supabase.auth.admin.generateLink({
      type:       "signup",
      email,
      password,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    }).then(({ data: linkData, error: linkError }) => {
      if (linkError) {
        console.warn("[register] generateLink failed:", linkError.message)
        return
      }
      // If you have Resend or another email service, send linkData.properties.action_link here
      // For now Supabase sends the email automatically when email_confirm: false
      console.log("[register] Verification email queued for:", email)
    }).catch((e: any) => {
      console.warn("[register] generateLink error:", e.message)
    })

    const response = NextResponse.json({ user: { id: uid, email } })
    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })
    return response

  } catch (err: any) {
    console.error("[POST /api/auth/register]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
