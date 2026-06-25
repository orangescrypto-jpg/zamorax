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

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json().catch(() => ({}))
    const supabase = getSupabase()
    if (access_token) {
      await supabase.auth.admin?.signOut?.(access_token).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
