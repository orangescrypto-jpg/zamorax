// app/api/orders/layaway-progress/route.ts
// Shows a layaway plan's full progress: amount paid, amount remaining,
// and every individual installment payment, in order. Accessible to the
// plan's own buyer, its seller, and any admin or moderator -- each of
// them needs to track how a buyer is progressing toward full payment.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB
  const planId = req.nextUrl.searchParams.get("planId")
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 })

  try {
    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })

    const isOwner = String(plan.buyer_id) === auth.uid || String(plan.seller_id) === auth.uid
    const isStaff = auth.role === "admin" || auth.role === "moderator"
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }

    const paymentRows = await d1Query(
      "SELECT * FROM layaway_payments WHERE plan_id = ? ORDER BY paid_at ASC",
      [planId],
      nativeDB,
    )

    return NextResponse.json({
      plan,
      payments: paymentRows?.results ?? [],
      remainingKobo: Number(plan.total_amount) - Number(plan.amount_paid),
    })
  } catch (err: any) {
    console.error("[orders/layaway-progress]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
