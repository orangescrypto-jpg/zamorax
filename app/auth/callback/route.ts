// app/auth/callback/route.ts  — REPLACE EXISTING FILE
// Handles Supabase auth redirects: email verification, password reset, OAuth.

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code  = searchParams.get("code")
  const next  = searchParams.get("next") ?? "/"
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? error)}`,
    )
  }

  if (code) {
    const responseCookies: Array<{ name: string; value: string; options: any }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((c) => responseCookies.push(c))
          },
        },
      },
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      const response = NextResponse.redirect(`${origin}${next}`)
      responseCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
