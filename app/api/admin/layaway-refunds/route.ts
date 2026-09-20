// app/api/admin/layaway-refunds/route.ts
// Admin and moderator can both see and act on pending layaway refunds.
// GET lists plans where refund_status = 'pending_review' (cancelled or
// expired, awaiting manual payout) plus their bank details.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireModerator(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB
  const statusFilter = req.nextUrl.searchParams.get("status") || "pending_review"

  try {
    const rows = await d1Query(
      "SELECT * FROM layaway_plans WHERE refund_status = ? ORDER BY refund_requested_at DESC LIMIT 200",
      [statusFilter],
      nativeDB,
    )
    return NextResponse.json({ plans: rows?.results ?? [] })
  } catch (err: any) {
    console.error("[admin/layaway-refunds GET]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
