// app/api/auth/me/route.ts
// Returns the current user profile based on the httpOnly sb-uid cookie.
// Called on every page load by providers.tsx to restore session after refresh.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  })
  const json = await res.json() as any
  if (!json.success) throw new Error(`D1: ${json.errors?.[0]?.message ?? "unknown"}`)
  return (json.result?.[0]?.results ?? []) as T[]
}

export async function GET(req: NextRequest) {
  try {
    // Primary: read uid from httpOnly cookie set by login route
    const cookieUid   = req.cookies.get("sb-uid")?.value ?? null
    const cookieToken = req.cookies.get("sb-access-token")?.value ?? null

    let uid: string | null = cookieUid

    // Fallback: verify Bearer token if no cookie (e.g. first login)
    if (!uid && cookieToken) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
      const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (supabaseUrl && (serviceKey || anonKey)) {
        try {
          const key    = serviceKey ?? anonKey!
          const client = createClient(supabaseUrl, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
          const { data: { user } } = await client.auth.getUser(cookieToken)
          if (user?.id) uid = user.id
        } catch { /* fall through */ }
      }
    }

    if (!uid) {
      return NextResponse.json({ error: "No session" }, { status: 401 })
    }

    // Fetch profile from D1
    const rows = await d1Query<Record<string, unknown>>(
      "SELECT * FROM users WHERE uid = ? LIMIT 1",
      [uid]
    )

    if (!rows[0]) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ profile: rows[0] })
  } catch (err: any) {
    console.error("[GET /api/auth/me]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
