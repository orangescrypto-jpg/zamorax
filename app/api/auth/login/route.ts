// app/api/auth/login/route.ts
// Server-side Supabase auth proxy — browser never calls Supabase directly.
// This eliminates CORS issues entirely.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error("Supabase env vars missing on server")
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error)
      return NextResponse.json({ error: error.message }, { status: 401 })

    if (!data.user || !data.session)
      return NextResponse.json({ error: "Login failed — no user returned" }, { status: 401 })

    return NextResponse.json({
      user: {
        id:    data.user.id,
        email: data.user.email,
        app_metadata:  data.user.app_metadata,
        user_metadata: data.user.user_metadata,
      },
      session: {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at:    data.session.expires_at,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
