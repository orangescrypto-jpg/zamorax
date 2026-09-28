// app/api/debug/auth-check/route.ts — Supabase version
// Debug endpoint to check if Supabase auth env vars are set and the
// Bearer token (Supabase access_token) resolves to a valid user.
//
// Previously this had no gate at all — requireAuth's result was computed
// but never checked, so it returned env-var presence and a token prefix to
// anyone, logged in or not. Now admin-only, and no token material is echoed.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  return NextResponse.json({
    env: {
      SUPABASE_URL:      !!process.env.NEXT_PUBLIC_SUPABASE_URL      ? "set" : "MISSING",
      SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING",
    },
    tokenValid: true,
    uid: auth.uid,
  })
}
