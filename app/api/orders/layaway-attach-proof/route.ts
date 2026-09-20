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
    const { planId, proofUrl } = await req.json()
    if (!planId || !proofUrl) {
      return NextResponse.json({ error: "planId and proofUrl required" }, { status: 400 })
    }

    const planRows = await d1Query(
      "SELECT id, buyer_id, total_amount FROM layaway_plans WHERE id = ? LIMIT 1",
      [planId],
      nativeDB,
    )
    const plan = planRows?.results?.[0] as { id: string; buyer_id: string; total_amount: number } | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (String(plan.buyer_id) !== auth.uid) {
      return NextResponse.json({ error: "Not authorized to update this plan" }, { status: 403 })
    }

    await d1Query(
      "UPDATE layaway_payments SET proof_url = ? WHERE plan_id = ? AND provider_ref = ?",
      [proofUrl, planId, `${planId}-deposit`],
      nativeDB,
    )

    const users = await AdminService.getCollection("users") as Record<string, unknown>[]
    const admins = users.filter(u => u.role === "admin")
    const amountNaira = `₦${(Number(plan.total_amount) / 100).toLocaleString("en-NG")}`

    for (const admin of admins) {
      const adminUserId = String(admin.uid ?? admin.id ?? "")
      if (!adminUserId) continue
      await AdminService.addDoc("notifications", {
        user_id: adminUserId,
        type: "system",
        title: "💳 Layaway Deposit Proof Submitted",
        body: `A buyer submitted payment proof for a layaway deposit on an order worth ${amountNaira}. Please verify and confirm.`,
        link: "/admin/layaway-manual-pending",
        is_read: false,
      })
    }

    return NextResponse.json({ success: true, adminsNotified: admins.length })
  } catch (err: any) {
    console.error("layaway-attach-proof error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
