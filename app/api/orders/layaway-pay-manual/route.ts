// app/api/orders/layaway-pay-manual/route.ts
// Requests a manual bank transfer top-up on an active layaway plan. Adds
// a layaway_payments row in "pending_admin_review" status right away
// (same convention as the deposit path in create-layaway-manual), and
// shows the buyer the bank details to pay into. The amount is only
// credited to the plan once an admin confirms it via
// app/api/admin/layaway-manual-topup-confirm/route.ts.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getPlatformSettings } from "@/src/services/platformSettings"
import { ManualPaymentService } from "@/src/services/providers/manual/payment"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const platformSettings = await getPlatformSettings()
    if (!platformSettings.manualPaymentEnabled) {
      return NextResponse.json({ error: "Manual bank transfer is not currently available" }, { status: 403 })
    }

    const { planId, amountKobo } = await req.json()
    if (!planId || !amountKobo || amountKobo <= 0) {
      return NextResponse.json({ error: "planId and a positive amountKobo required" }, { status: 400 })
    }

    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.buyer_id) !== auth.uid) return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    if (String(plan.status) !== "active") {
      return NextResponse.json({ error: `This plan is ${plan.status}, no further payments accepted` }, { status: 409 })
    }

    const remaining = Number(plan.total_amount) - Number(plan.amount_paid)
    if (amountKobo > remaining) {
      return NextResponse.json({ error: "Amount exceeds what is left on this plan" }, { status: 400 })
    }

    const paymentId = crypto.randomUUID()
    const now = new Date().toISOString()
    const providerRef = `manual-topup-${paymentId}`

    await d1Query(
      `INSERT INTO layaway_payments (id, plan_id, amount, provider, provider_ref, status, paid_at, created_at)
       VALUES (?, ?, ?, 'manual', ?, 'pending_admin_review', ?, ?)`,
      [paymentId, planId, amountKobo, providerRef, now, now],
      nativeDB,
    )

    const bankDetails = await ManualPaymentService.getBankDetails()

    return NextResponse.json({
      success: true,
      paymentId,
      bankDetails: bankDetails ?? {
        bankName: "Bank name not set, contact admin",
        accountNumber: "Not configured",
        accountName: "Not configured",
      },
    })
  } catch (err: any) {
    console.error("layaway-pay-manual error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
