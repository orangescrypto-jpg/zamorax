// app/api/auth/register/route.ts
// Uses Supabase Auth instead of Firebase Admin SDK.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit"

// Merges Next.js required context shape with Cloudflare Pages env binding.
// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    // Account creation is cheap to abuse (fake sellers, bulk fraud accounts) —
    // keep this tighter than login: 5 signups / hour per IP.
    const ip = getClientIp(req)
    const rl = await rateLimit(`register:${ip}`, { limit: 5, windowSeconds: 3600 }, nativeDB)
    if (!rl.allowed) return rateLimitResponse(rl)

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
      if (message.includes("already registered") || message.includes("already been registered"))
        message = "An account with this email already exists."
      if (message.includes("weak") || message.includes("password"))
        message = "Password must be at least 6 characters."
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

    // ── 4. Send Supabase email verification (fire-and-forget) ─────
    supabase.auth.admin.generateLink({
      type:    "signup",
      email,
      password,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    }).then(({ data: linkData, error: linkError }) => {
      if (linkError) {
        console.warn("[register] generateLink failed:", linkError.message)
        return
      }
      console.log("[register] Verification email queued for:", email)
    }).catch((e: any) => {
      console.warn("[register] generateLink error:", e.message)
    })

    // ── 5. Welcome email — server-to-server, fire-and-forget ───────
    // Triggered here (not from the browser) so /api/email/send can be
    // locked down to internal-only callers — see app/api/email/send/route.ts.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
    if (appUrl && process.env.INTERNAL_EMAIL_SECRET) {
      fetch(`${appUrl}/api/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_EMAIL_SECRET,
        },
        body: JSON.stringify({
          type: "welcome",
          to: email,
          data: { name: fullName, role: role ?? "buyer" },
        }),
      }).catch((e: any) => {
        console.warn("[register] welcome email trigger failed:", e.message)
      })
    }

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
