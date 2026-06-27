// app/api/d1/query/route.ts
// Generic server-side proxy for AdminService's internal d1Query.
//
// AdminService (src/services/providers/cloudflare/admin.ts) is imported by
// many "use client" pages across the app. Its SQL queries must run server-side
// only — CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN are never available
// in the browser bundle. This route lets AdminService detect it's running
// client-side and forward the query here instead of hitting Cloudflare's API
// directly from the browser (which previously failed with "Failed to fetch").
//
// This is intentionally permissive on read queries (SELECT) so existing
// dashboard pages keep working unchanged. Mutating queries still require a
// valid Supabase session, since anonymous writes would be a real risk.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function getSessionUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    const { sql, params } = await req.json()
    if (typeof sql !== "string" || !sql.trim()) {
      return NextResponse.json({ error: "Missing sql" }, { status: 400 })
    }

    const isWrite = !/^\s*(select|pragma)/i.test(sql)
    if (isWrite) {
      const user = await getSessionUser(req)
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const result = await d1Query(sql, Array.isArray(params) ? params : [], nativeDB)
    const rows = (result as any)?.results ?? []
    return NextResponse.json({ results: rows })
  } catch (err: any) {
    console.error("[api/d1/query]", err)
    return NextResponse.json({ error: err.message ?? "D1 query failed" }, { status: 500 })
  }
}
