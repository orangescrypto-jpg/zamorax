// app/auth/callback/route.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE → NOW SUPABASE
// Handles OAuth redirect callback (Google sign-in).
// Supabase redirects here after Google auth, exchanges code for session.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code  = searchParams.get("code")
  const next  = searchParams.get("next") ?? "/"
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
