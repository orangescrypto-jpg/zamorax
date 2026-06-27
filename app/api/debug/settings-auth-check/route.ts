// app/api/debug/settings-auth-check/route.ts — Supabase version
// Verifies that Supabase auth and D1 env vars are wired up correctly.
// Remove or restrict in production.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)

  const errors: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)      errors.push("NEXT_PUBLIC_SUPABASE_URL not set")
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY not set")
  if (!process.env.CF_ACCOUNT_ID)                 errors.push("CF_ACCOUNT_ID not set")
  if (!process.env.CF_D1_DATABASE_ID)             errors.push("CF_D1_DATABASE_ID not set")
  if (!process.env.CF_API_TOKEN)                  errors.push("CF_API_TOKEN not set")

  return NextResponse.json({
    auth: {
      uid:    auth.ok ? auth.uid  : null,
      role:   auth.ok ? auth.role : null,
      method: auth.ok ? "supabase_bearer" : null,
      error:  auth.ok ? null : "Supabase token verification failed or not an admin",
    },
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
