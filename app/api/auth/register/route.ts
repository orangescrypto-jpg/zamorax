// app/api/auth/register/route.ts
// Server-side Supabase auth proxy for registration.
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
    const { email, password, fullName, username, phone, role } = await req.json()
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })

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

    return NextResponse.json({
      user: {
        id:    data.user.id,
        email: data.user.email,
        app_metadata:  data.user.app_metadata,
        user_metadata: data.user.user_metadata,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
