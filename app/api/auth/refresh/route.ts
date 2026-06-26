// app/api/auth/refresh/route.ts
// Uses the sb-refresh-token httpOnly cookie to get a new access token
// and reissue all auth cookies. Called from the settings page on mount.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("sb-refresh-token")?.value
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase env missing" }, { status: 500 })
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

    if (error || !data.session || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Refresh failed" }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true, uid: data.user.id })

    const tokenMaxAge = data.session.expires_at
      ? data.session.expires_at - Math.floor(Date.now() / 1000)
      : 3600

    response.cookies.set("sb-access-token", data.session.access_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   tokenMaxAge,
    })
    response.cookies.set("sb-uid", data.user.id, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   7 * 24 * 60 * 60,
    })
    response.cookies.set("sb-refresh-token", data.session.refresh_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   7 * 24 * 60 * 60,
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
