// app/api/auth/me/route.ts  — REPLACE EXISTING FILE
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

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

    const result = await d1Query(
      "SELECT * FROM users WHERE uid = ? LIMIT 1",
      [user.id],
      nativeDB,
    )
    const profile = (result as any)?.results?.[0]
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (err: any) {
    console.error("[GET /api/auth/me]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
