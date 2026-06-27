// app/auth/callback/route.ts
// Handles Supabase auth redirects: email verification, password reset, OAuth.
// After a successful OAuth login, syncs the user to D1 if they don't exist yet.

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

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
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach((c) => responseCookies.push(c))
          },
        },
      },
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError && data.user) {
      // ── Sync OAuth user to D1 ────────────────────────────────────────
      // Email/password users are already inserted by /api/auth/register.
      // ON CONFLICT DO NOTHING makes this safe to run for both — no double-insert.
      try {
        const user = data.user
        const now  = new Date().toISOString()
        const name = user.user_metadata?.full_name
                  ?? user.user_metadata?.name
                  ?? user.email?.split("@")[0]
                  ?? "User"
        const role = (user.user_metadata?.role as string) ?? "buyer"

        await d1Query(
          `INSERT INTO users (
            uid, email, phone, full_name, username, role, plan,
            verification_level, nin_verified, bvn_verified, phone_verified,
            email_verified, is_banned, active_listing_count, seller_rating,
            total_sales, total_rentals, is_seller_ready,
            wallet_balance, store_name, store_description, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(uid) DO NOTHING`,
          [
            user.id, user.email ?? "", null, name, null,
            role, "free", "none",
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            null, null, now, now,
          ],
        )
      } catch (syncErr: any) {
        // Non-fatal — log and continue. User is authenticated in Supabase;
        // D1 sync can be retried on next login via the JWT hook if needed.
        console.error("[auth/callback] D1 sync failed:", syncErr.message)
      }
      // ────────────────────────────────────────────────────────────────

      const response = NextResponse.redirect(`${origin}${next}`)
      responseCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
