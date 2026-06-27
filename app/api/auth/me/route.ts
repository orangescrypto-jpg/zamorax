// app/api/auth/me/route.ts  — REPLACE EXISTING FILE
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll() {},
        },
      },
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: "No session" }, { status: 401 })
    }

    const accountId  = process.env.CF_ACCOUNT_ID
    const databaseId = process.env.CF_D1_DATABASE_ID
    const apiToken   = process.env.CF_API_TOKEN

    if (!accountId || !databaseId || !apiToken) {
      return NextResponse.json({ error: "D1 not configured" }, { status: 500 })
    }

    const d1Res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiToken}` },
        body:   JSON.stringify({ sql: "SELECT * FROM users WHERE uid = ? LIMIT 1", params: [user.id] }),
        cache:  "no-store",
      },
    )

    const json = await d1Res.json() as any
    if (!json.success) throw new Error(json.errors?.[0]?.message ?? "D1 error")

    const profile = json.result?.[0]?.results?.[0]
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (err: any) {
    console.error("[GET /api/auth/me]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
