// app/api/debug/auth-check/route.ts — Supabase version
// Debug endpoint to check if Supabase auth env vars are set and the
// Bearer token (Supabase access_token) resolves to a valid user.
// Remove or restrict in production.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  const auth = await requireAuth(req)
  const tokenValid = auth.ok
  const uid        = auth.ok ? auth.uid : null

  return NextResponse.json({
    env: {
      SUPABASE_URL:      !!process.env.NEXT_PUBLIC_SUPABASE_URL      ? "set" : "MISSING",
      SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING",
    },
    bearer:     bearerToken ? `${bearerToken.slice(0, 20)}...` : null,
    tokenValid,
    uid,
  })
}
