// app/api/admin/layaway-refunds/[planId]/mark-paid/route.ts
// Admin or moderator clicks "Refunded" after manually paying the buyer's
// bank account shown on the refund review screen. This does not move any
// money itself -- it records that the payout was made outside the
// platform, starts the 24 hour window for the buyer to confirm receipt,
// and flips the buyer's visible status to "refunded, pending confirmation".
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<{ planId: string }>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireModerator(req)
  if (!auth.ok) return auth.error

  const { planId } = await context.params
  const nativeDB = (context as any)?.env?.DB

  try {
    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (plan.refund_status !== "pending_review") {
      return NextResponse.json({ error: `Refund is already ${plan.refund_status}` }, { status: 409 })
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const confirmDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    await d1Query(
      `UPDATE layaway_plans SET
        refund_status = 'paid', refund_paid_at = ?, refund_paid_by = ?,
        refund_confirm_deadline = ?, updated_at = ?
      WHERE id = ?`,
      [nowIso, auth.uid, confirmDeadline, nowIso, planId],
      nativeDB,
    )

    try {
      const { sendPushNotification } = await import("@/src/services/webPush")
      await sendPushNotification({
        userId: String(plan.buyer_id),
        type: "layaway_reminder",
        title: "Refund sent",
        body: "Your layaway refund has been paid to your bank account. Please confirm you have received it within 24 hours.",
        link: `/dashboard/buyer/orders/${plan.order_id}`,
        nativeDB,
      })
    } catch (err) {
      console.error("mark-paid: notification failed (non-fatal):", err)
    }

    return NextResponse.json({ success: true, confirmDeadline })
  } catch (err: any) {
    console.error("[admin/layaway-refunds mark-paid]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
