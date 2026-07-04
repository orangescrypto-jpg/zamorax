// app/api/subscriptions/create-pending/route.ts
// "subscriptions" is an ADMIN_ONLY table in the D1 proxy (app/api/d1/query/route.ts)
// — sellers can't write it directly from the browser. This route creates the
// pending subscription row server-side, the same way boosts/adBoosts create
// their record only once payment has actually been initiated/submitted
// (never littering the table with rows nobody paid for).
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
    const { plan, amount, paymentReference, paymentProvider } = await req.json()
    if (!plan || !amount || !paymentReference) {
      return NextResponse.json({ error: "plan, amount, and paymentReference are required" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await d1Query(
      `INSERT INTO subscriptions (id, user_id, plan, amount, status, payment_reference, payment_provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, auth.uid, plan, amount, "pending_payment", paymentReference, paymentProvider ?? "manual", now],
      nativeDB,
    )

    return NextResponse.json({ success: true, subscriptionId: id })
  } catch (err: any) {
    console.error("[POST /api/subscriptions/create-pending]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
