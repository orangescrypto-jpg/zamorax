// app/api/debug/auth-check/route.ts
// TEMPORARY DEBUG ENDPOINT — DELETE AFTER FIXING
// Visit logged-in: /api/debug/auth-check
// It auto-reads your uid from the zamorax-auth cookie/store via ?uid= param
// OR pass ?uid=YOUR_UID manually
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  // Try to resolve uid from Bearer token automatically
  let autoUid: string | null = null
  let tokenError: string | null = null

  const authHeader = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (bearerToken) {
    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
      )
      const { data: { user }, error } = await client.auth.getUser(bearerToken)
      if (user?.id) autoUid = user.id
      if (error) tokenError = error.message
    } catch (e: any) { tokenError = e.message }
  }

  // Manual uid param overrides
  const uid = req.nextUrl.searchParams.get("uid") ?? autoUid

  const envCheck = {
    CF_ACCOUNT_ID:     !!process.env.CF_ACCOUNT_ID     ? "set" : "MISSING",
    CF_D1_DATABASE_ID: !!process.env.CF_D1_DATABASE_ID ? "set" : "MISSING",
    CF_API_TOKEN:      !!process.env.CF_API_TOKEN       ? "set" : "MISSING",
    SUPABASE_URL:      !!process.env.NEXT_PUBLIC_SUPABASE_URL       ? "set" : "MISSING",
    SUPABASE_ANON:     !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  ? "set" : "MISSING",
  }

  let d1Result: any = null
  let d1Error: string | null = null
  let allAdmins: any[] = []

  if (process.env.CF_ACCOUNT_ID && process.env.CF_D1_DATABASE_ID && process.env.CF_API_TOKEN) {
    const d1Fetch = async (sql: string, params: unknown[] = []) => {
      const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.CF_API_TOKEN}` },
        body: JSON.stringify({ sql, params }),
        cache: "no-store",
      })
      const json = await res.json() as any
      return { status: res.status, success: json.success, errors: json.errors, rows: json.result?.[0]?.results ?? [] }
    }

    try {
      // List all admin users so you can see what UIDs exist
      allAdmins = (await d1Fetch("SELECT uid, role, email FROM users WHERE role = 'admin' LIMIT 10")).rows
    } catch (e: any) { d1Error = e.message }

    if (uid) {
      try {
        d1Result = await d1Fetch("SELECT uid, role, email FROM users WHERE uid = ? LIMIT 1", [uid])
      } catch (e: any) { d1Error = e.message }
    }
  }

  return NextResponse.json({
    envVars: envCheck,
    tokenError,
    uidTested: uid,
    d1UidQuery: d1Result,
    allAdminRows: allAdmins,
    d1Error,
    instruction: !uid
      ? "No UID found. Go to Supabase Dashboard → Authentication → Users → copy your UUID → visit ?uid=PASTE_HERE"
      : null,
  })
}
