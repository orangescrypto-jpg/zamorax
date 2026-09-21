// app/api/orders/layaway-topup-proof/route.ts
// Attaches a buyer's payment-proof screenshot to ONE manual bank-transfer
// top-up (the layaway_payments row created by layaway-pay-manual), then
// notifies admins to verify it.
//
// layaway-attach-proof can't be reused for this: it only updates the
// deposit row (provider_ref = "<planId>-deposit"). A top-up row has
// provider_ref = "manual-topup-<paymentId>", so that route would match
// nothing and silently save no proof.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { paymentId, proofUrl } = await req.json()
    if (!paymentId || !proofUrl || typeof proofUrl !== "string") {
      return NextResponse.json({ error: "paymentId and proofUrl required" }, { status: 400 })
    }

    const paymentRows = await d1Query(
      "SELECT id, plan_id, amount, provider, status FROM layaway_payments WHERE id = ? LIMIT 1",
      [paymentId],
      nativeDB,
    )
    const payment = paymentRows?.results?.[0] as
      | { id: string; plan_id: string; amount: number; provider: string; status: string }
      | undefined
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

    // Only manual transfers still awaiting review can take a proof.
    if (payment.provider !== "manual" || payment.status !== "pending_admin_review") {
      return NextResponse.json(
        { error: "This payment is no longer awaiting review, so proof can't be added" },
        { status: 409 },
      )
    }

    // Ownership is checked through the plan, never trusted from the client.
    const planRows = await d1Query(
      "SELECT id, buyer_id, order_id FROM layaway_plans WHERE id = ? LIMIT 1",
      [payment.plan_id],
      nativeDB,
    )
    const plan = planRows?.results?.[0] as { id: string; buyer_id: string; order_id: string } | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.buyer_id) !== auth.uid) {
      return NextResponse.json({ error: "Not authorised to update this payment" }, { status: 403 })
    }

    await d1Query(
      "UPDATE layaway_payments SET proof_url = ? WHERE id = ?",
      [proofUrl, paymentId],
      nativeDB,
    )

    // Notify admins. Non-fatal: the proof is already saved, and the
    // payment shows in /admin/layaway-manual-pending regardless.
    let adminsNotified = 0
    try {
      const users = (await AdminService.getCollection("users")) as Record<string, unknown>[]
      const admins = users.filter(u => u.role === "admin")
      const amountNaira = `₦${(Number(payment.amount) / 100).toLocaleString("en-NG")}`
      for (const admin of admins) {
        const adminUserId = String(admin.uid ?? admin.id ?? "")
        if (!adminUserId) continue
        await AdminService.addDoc("notifications", {
          user_id: adminUserId,
          type: "system",
          title: "💳 Layaway Top-up Proof Submitted",
          body: `A buyer submitted payment proof for a ${amountNaira} layaway top-up. Please verify and confirm.`,
          link: "/admin/layaway-manual-pending",
          is_read: false,
        })
        adminsNotified++
      }
    } catch (err) {
      console.error("layaway-topup-proof: admin notification failed (non-fatal):", err)
    }

    return NextResponse.json({ success: true, adminsNotified })
  } catch (err: any) {
    console.error("layaway-topup-proof error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
