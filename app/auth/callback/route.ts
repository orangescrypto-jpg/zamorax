// app/auth/callback/route.ts
// Firebase OAuth (Google) uses signInWithPopup on the client — no server
// callback route is needed. This route exists only to handle any stray
// redirects (e.g. from email verification links) gracefully.

import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)

  // Firebase email verification: mode=verifyEmail redirects here
  const mode  = searchParams.get("mode")
  const next  = searchParams.get("next") ?? "/"
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (mode === "verifyEmail") {
    // Firebase handles the actual verification client-side via the oobCode.
    // Redirect to login with a success hint so the UI can show a toast.
    return NextResponse.redirect(`${origin}/login?verified=1`)
  }

  if (mode === "resetPassword") {
    // Forward to the reset-password page with all params intact
    const params = searchParams.toString()
    return NextResponse.redirect(`${origin}/auth/reset-password?${params}`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
