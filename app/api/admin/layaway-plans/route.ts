// app/api/admin/layaway-plans/route.ts
// Admin and moderator list of all layaway plans, any status, so both
// roles can track how buyers are progressing on their payments -- the
// same progress data available to the buyer and seller on their own
// order pages, just listed in bulk here for staff oversight.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireModerator(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB
  const status = req.nextUrl.searchParams.get("status")

  try {
    const rows = status
      ? await d1Query("SELECT * FROM layaway_plans WHERE status = ? ORDER BY created_at DESC LIMIT 200", [status], nativeDB)
      : await d1Query("SELECT * FROM layaway_plans ORDER BY created_at DESC LIMIT 200", [], nativeDB)
    return NextResponse.json({ plans: rows?.results ?? [] })
  } catch (err: any) {
    console.error("[admin/layaway-plans]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
