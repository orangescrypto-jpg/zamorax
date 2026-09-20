// app/api/admin/layaway-manual-pending/route.ts
// Admin-only. Lists layaway plans created via manual bank transfer that
// are still waiting for an admin to confirm the deposit was received,
// plus any manual top-up payments awaiting confirmation on already
// active plans.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const deposits = await d1Query(
      "SELECT * FROM layaway_plans WHERE status = 'pending_admin_confirmation' ORDER BY created_at DESC LIMIT 200",
      [],
      nativeDB,
    )
    const topups = await d1Query(
      `SELECT lp.*, pl.order_id, pl.total_amount, pl.amount_paid
       FROM layaway_payments lp
       JOIN layaway_plans pl ON pl.id = lp.plan_id
       WHERE lp.provider = 'manual' AND lp.status = 'pending_admin_review' AND pl.status = 'active'
       ORDER BY lp.created_at DESC LIMIT 200`,
      [],
      nativeDB,
    )
    return NextResponse.json({
      deposits: deposits?.results ?? [],
      topups: topups?.results ?? [],
    })
  } catch (err: any) {
    console.error("[admin/layaway-manual-pending]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
