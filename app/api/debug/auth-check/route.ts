// app/api/debug/auth-check/route.ts
// TEMPORARY DEBUG ENDPOINT — DELETE AFTER FIXING
// Visit: /api/debug/auth-check?uid=YOUR_UID_HERE
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid") ?? req.headers.get("x-user-id") ?? null

  const envCheck = {
    CF_ACCOUNT_ID:     !!process.env.CF_ACCOUNT_ID     ? "set" : "MISSING",
    CF_D1_DATABASE_ID: !!process.env.CF_D1_DATABASE_ID ? "set" : "MISSING",
    CF_API_TOKEN:      !!process.env.CF_API_TOKEN       ? "set" : "MISSING",
    SUPABASE_URL:      !!process.env.NEXT_PUBLIC_SUPABASE_URL       ? "set" : "MISSING",
    SUPABASE_ANON:     !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  ? "set" : "MISSING",
  }

  let d1Result: any = null
  let d1Error: string | null = null

  if (uid && process.env.CF_ACCOUNT_ID && process.env.CF_D1_DATABASE_ID && process.env.CF_API_TOKEN) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
        },
        body: JSON.stringify({ sql: "SELECT uid, role FROM users WHERE uid = ? LIMIT 1", params: [uid] }),
        cache: "no-store",
      })
      const json = await res.json() as any
      d1Result = {
        httpStatus: res.status,
        d1Success: json.success,
        errors: json.errors,
        rows: json.result?.[0]?.results ?? [],
      }
    } catch (e: any) {
      d1Error = e.message
    }
  }

  return NextResponse.json({
    envVars: envCheck,
    uidTested: uid,
    d1Query: d1Result,
    d1Error,
    tip: !uid ? "Add ?uid=YOUR_SUPABASE_UID to test the D1 role lookup" : null,
  })
}
