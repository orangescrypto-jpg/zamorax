// app/api/debug/settings-auth-check/route.ts
// TEMPORARY DEBUG ENDPOINT — DELETE AFTER FIXING
// Mirrors the exact isAdmin() logic from /api/admin/settings but returns
// a detailed breakdown of every strategy and why it passed/failed.
//
// Usage: open this page on your phone WHILE logged in (same browser/session)
// so the request carries the same cookies as a real navigation:
//   https://zamorax.vercel.app/api/debug/settings-auth-check
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  })
  const json = await res.json() as any
  if (!json.success) throw new Error(`D1 error: ${json.errors?.[0]?.message ?? "unknown"}`)
  return (json.result?.[0]?.results ?? []) as T[]
}

async function checkRoleByUid(uid: string): Promise<{ isAdmin: boolean; role?: string; error?: string }> {
  try {
    const rows = await d1Query<{ role: string }>("SELECT role FROM users WHERE uid = ? LIMIT 1", [uid])
    if (!rows[0]) return { isAdmin: false, error: "No D1 row found for this uid" }
    return { isAdmin: rows[0].role === "admin", role: rows[0].role }
  } catch (e: any) {
    return { isAdmin: false, error: e.message }
  }
}

async function verifyJwt(token: string): Promise<{ uid: string | null; method: string | null; error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) return { uid: null, method: null, error: "NEXT_PUBLIC_SUPABASE_URL missing" }

  const errors: string[] = []

  if (serviceKey) {
    try {
      const { data: { user }, error } = await createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).auth.getUser(token)
      if (!error && user?.id) return { uid: user.id, method: "service_role" }
      if (error) errors.push(`service_role: ${error.message}`)
    } catch (e: any) { errors.push(`service_role threw: ${e.message}`) }
  } else {
    errors.push("SUPABASE_SERVICE_ROLE_KEY not set")
  }

  if (anonKey) {
    try {
      const { data: { user }, error } = await createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }).auth.getUser(token)
      if (!error && user?.id) return { uid: user.id, method: "anon_key" }
      if (error) errors.push(`anon_key: ${error.message}`)
    } catch (e: any) { errors.push(`anon_key threw: ${e.message}`) }
  } else {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY not set")
  }

  return { uid: null, method: null, error: errors.join(" | ") }
}

export async function GET(req: NextRequest) {
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const headerUid   = req.headers.get("x-user-id")
  const internalSec = req.headers.get("x-internal-secret")
  const cookieToken = req.cookies.get("sb-access-token")?.value ?? null
  const cookieUid   = req.cookies.get("sb-uid")?.value ?? null

  const report: any = {
    incomingRequest: {
      hasAuthorizationHeader: !!bearerToken,
      hasXUserIdHeader: !!headerUid,
      hasXInternalSecretHeader: !!internalSec,
      hasCookieToken: !!cookieToken,
      hasCookieUid: !!cookieUid,
    },
    envCheck: {
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!anonKey ? "set" : "MISSING",
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
    },
    strategies: {},
    finalResult: false,
  }

  // Strategy 1: Bearer header
  if (bearerToken) {
    const jwt = await verifyJwt(bearerToken)
    const role = jwt.uid ? await checkRoleByUid(jwt.uid) : null
    report.strategies.bearerHeader = { ...jwt, roleCheck: role }
    if (jwt.uid && role?.isAdmin) report.finalResult = true
  } else {
    report.strategies.bearerHeader = "skipped — no Authorization header sent"
  }

  // Strategy 3: cookie token
  if (cookieToken) {
    const jwt = await verifyJwt(cookieToken)
    const role = jwt.uid ? await checkRoleByUid(jwt.uid) : null
    report.strategies.cookieToken = { ...jwt, roleCheck: role }
    if (jwt.uid && role?.isAdmin) report.finalResult = true
  } else {
    report.strategies.cookieToken = "skipped — no sb-access-token cookie present"
  }

  // Strategy 4: cookie uid + secret
  if (cookieUid && internalSec) {
    const secretMatch = internalSec === anonKey
    const role = secretMatch ? await checkRoleByUid(cookieUid) : null
    report.strategies.cookieUidPlusSecret = { cookieUid, secretMatch, roleCheck: role }
    if (secretMatch && role?.isAdmin) report.finalResult = true
  } else {
    report.strategies.cookieUidPlusSecret = "skipped — missing sb-uid cookie or x-internal-secret header"
  }

  // Strategy 5: header uid + secret
  if (headerUid && internalSec) {
    const secretMatch = internalSec === anonKey
    const role = secretMatch ? await checkRoleByUid(headerUid) : null
    report.strategies.headerUidPlusSecret = { headerUid, secretMatch, roleCheck: role }
    if (secretMatch && role?.isAdmin) report.finalResult = true
  } else {
    report.strategies.headerUidPlusSecret = "skipped — missing x-user-id or x-internal-secret header"
  }

  return NextResponse.json(report)
}
