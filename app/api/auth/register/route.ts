// app/api/auth/register/route.ts
// Server-side Supabase auth proxy for registration.
// Also creates the D1 user profile — keeps all secrets server-side.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase env vars missing on server")
  return createClient(url, key)
}

// ── Cloudflare D1 HTTP helper ─────────────────────────────────────
async function d1Query(sql: string, params: unknown[] = []) {
  const accountId  = process.env.CF_ACCOUNT_ID
  const databaseId = process.env.CF_D1_DATABASE_ID
  const apiToken   = process.env.CF_API_TOKEN

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "D1 not configured: missing CF_ACCOUNT_ID, CF_D1_DATABASE_ID, or CF_API_TOKEN.",
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

export async function POST(req: NextRequest) {
  try {
    const {
      email, password, fullName, username, phone, role,
      // seller-only extras
      storeName, storeDescription, nigerianState, nin,
      referredBy,
    } = await req.json()

    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    // ── 1. Create Supabase auth user ──────────────────────────────
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username:  username?.toLowerCase(),
          phone:     phone ?? null,
          role:      role ?? "buyer",
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 })

    if (!data.user)
      return NextResponse.json({ error: "Registration failed — no user returned" }, { status: 400 })

    const uid = data.user.id
    const now = new Date().toISOString()

    // ── 2. Create D1 user profile ─────────────────────────────────
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
        uid,
        email,
        phone ?? null,
        fullName,
        username?.toLowerCase() ?? null,
        role ?? "buyer",
        "free",
        role === "seller" ? "nin" : "none",
        0, // nin_verified
        0, // bvn_verified
        0, // phone_verified
        0, // email_verified
        0, // is_banned
        0, // active_listing_count
        0, // seller_rating
        0, // total_sales
        0, // total_rentals
        0, // is_seller_ready
        storeName ?? null,
        storeDescription ?? null,
        now,
        now,
      ],
    )

    // ── 3. Create verification request for sellers ────────────────
    if (role === "seller" && nin) {
      await d1Query(
        `INSERT INTO verification_requests (
          user_id, user_name, user_email, phone, store_name,
          type, value, nigerian_state, status, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT DO NOTHING`,
        [uid, fullName, email, phone ?? null, storeName ?? null,
         "nin", nin, nigerianState ?? null, "pending", now],
      ).catch((e) => {
        // Non-fatal: log but don't fail registration
        console.warn("[register] verification_requests insert failed:", e.message)
      })
    }

    return NextResponse.json({
      user: {
        id:            uid,
        email:         data.user.email,
        app_metadata:  data.user.app_metadata,
        user_metadata: data.user.user_metadata,
      },
    })
  } catch (err: any) {
    console.error("[POST /api/auth/register]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
