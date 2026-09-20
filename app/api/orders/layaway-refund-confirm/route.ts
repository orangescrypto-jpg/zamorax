// app/api/orders/layaway-refund-confirm/route.ts
// Buyer clicks "Confirm I received my refund" within the 24 hour window
// after admin/moderator marks it paid. Sets a 12 hour purge timer after
// which the cron job permanently deletes the plan and its payment
// history, since the sale never completed and there is nothing more
// for buyer, seller, admin, or moderator to act on.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { planId } = await req.json()
    if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 })

    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.buyer_id) !== auth.uid) return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    if (plan.refund_status !== "paid") {
      return NextResponse.json({ error: `Nothing to confirm, refund status is ${plan.refund_status}` }, { status: 409 })
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const purgeAt = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString()

    await d1Query(
      `UPDATE layaway_plans SET
        refund_status = 'buyer_confirmed', refund_confirmed_at = ?, refund_confirmed_by = 'buyer',
        purge_at = ?, updated_at = ?
      WHERE id = ?`,
      [nowIso, purgeAt, nowIso, planId],
      nativeDB,
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("layaway-refund-confirm error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
