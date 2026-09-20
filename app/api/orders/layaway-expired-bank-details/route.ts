// app/api/orders/layaway-expired-bank-details/route.ts
// Used when a plan reaches status "expired" via the cron sweep (buyer did
// not cancel, the deadline simply passed). The buyer still needs to
// supply a bank account before admin/moderator can pay the refund, so
// this route accepts those details for an already-expired plan, the same
// way layaway-cancel accepts them for a voluntary cancellation.
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
    const { planId, bankName, accountNumber, accountName } = await req.json()
    if (!planId || !bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: "planId, bankName, accountNumber, and accountName are required" },
        { status: 400 },
      )
    }

    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.buyer_id) !== auth.uid) return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    if (plan.status !== "expired" || plan.refund_status !== "awaiting_bank_details") {
      return NextResponse.json({ error: "This plan is not awaiting bank details" }, { status: 409 })
    }

    const now = new Date().toISOString()

    await d1Query(
      `UPDATE layaway_plans SET
        refund_status = 'pending_review', refund_requested_at = ?,
        refund_bank_name = ?, refund_account_number = ?, refund_account_name = ?,
        refund_original_funding_note = ?, updated_at = ?
      WHERE id = ?`,
      [
        now, bankName.trim(), accountNumber.trim(), accountName.trim(),
        "Buyer states this is the same account used to fund the first payment on this plan.",
        now, planId,
      ],
      nativeDB,
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("layaway-expired-bank-details error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
