// app/api/auth/signout/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase env vars missing on server")
  return createClient(url, key)
}

// Helper to clear a cookie by name (sets it with maxAge=0)
function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   0,
  })
}

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json().catch(() => ({}))

    // Invalidate the Supabase session server-side if we have a token
    try {
      const supabase = getSupabase()
      if (access_token) {
        await supabase.auth.admin?.signOut?.(access_token).catch(() => {})
      }
    } catch { /* non-fatal — still clear cookies */ }

    const response = NextResponse.json({ ok: true })

    // ── CRITICAL: Clear the httpOnly cookies set at login ─────────────────
    // Without this, browsers keep sb-uid + sb-access-token after logout and
    // /api/auth/me will restore the session on the next page load, making
    // it appear the user is logged back in automatically.
    clearCookie(response, "sb-access-token")
    clearCookie(response, "sb-uid")

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
