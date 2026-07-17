// app/api/debug/settings-auth-check/route.ts — Supabase version
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { createServerClient } from "@supabase/ssr"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)

  const errors: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)      errors.push("NEXT_PUBLIC_SUPABASE_URL not set")
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY not set")
  if (!process.env.CF_ACCOUNT_ID)                 errors.push("CF_ACCOUNT_ID not set")
  if (!process.env.CF_D1_DATABASE_ID)             errors.push("CF_D1_DATABASE_ID not set")
  if (!process.env.CF_API_TOKEN)                  errors.push("CF_API_TOKEN not set")

  // Re-derive the Supabase session directly here (not swallowed) so we can
  // tell "no/invalid session" apart from "session ok, role lookup failed".
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  )
  const { data: { user }, error: sessionError } = await supabase.auth.getUser()

  let roleLookup: { ok: boolean; role?: string | null; error?: string } = { ok: false, error: "not attempted (no user)" }
  if (user) {
    try {
      const result = await d1Query("SELECT role FROM users WHERE uid = ? LIMIT 1", [user.id])
      const rows = (result as any)?.results ?? []
      roleLookup = { ok: true, role: rows[0]?.role ?? null }
    } catch (err: any) {
      // This is the error getRoleByUid() normally swallows into `null`.
      roleLookup = { ok: false, error: err?.message ?? String(err) }
    }
  }

  return NextResponse.json({
    auth: {
      uid:    auth.ok ? auth.uid  : null,
      role:   auth.ok ? auth.role : null,
      method: auth.ok ? "supabase_bearer" : null,
      error:  auth.ok ? null : "Supabase token verification failed or not an admin",
    },
    session: {
      hasUser: !!user,
      uid: user?.id ?? null,
      sessionError: sessionError?.message ?? null,
    },
    roleLookup, // <-- the actual bug will show here, e.g. a D1 auth error or "role: null"
    envErrors: errors,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:      !!process.env.NEXT_PUBLIC_SUPABASE_URL      ? "set" : "MISSING",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING",
      CF_ACCOUNT_ID:                 !!process.env.CF_ACCOUNT_ID                 ? "set" : "MISSING",
      CF_D1_DATABASE_ID:             !!process.env.CF_D1_DATABASE_ID             ? "set" : "MISSING",
      CF_API_TOKEN:                  !!process.env.CF_API_TOKEN                  ? "set" : "MISSING",
    },
  })
}
