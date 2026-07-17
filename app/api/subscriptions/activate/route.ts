// app/api/subscriptions/activate/route.ts
// Called from the seller's subscription success redirect for Paystack- or
// Flutterwave-paid plan upgrades. Verifies the transaction directly with
// whichever gateway processed it (never trusts the client-supplied "it
// succeeded"), then activates the plan the same way /api/payment/confirm
// does for admin-confirmed manual payments. Manual bank-transfer
// subscriptions are NOT touched here — those stay "pending_payment" until
// an admin confirms them at /admin/payments, exactly like today's
// boost/adBoost flow.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function verifyPaystack(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || "Paystack verification failed")
  return { verified: data.data.status === "success", amount: data.data.amount as number }
}

async function verifyFlutterwave(reference: string) {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  )
  const data = await res.json()
  if (data.status !== "success") throw new Error(data.message || "Flutterwave verification failed")
  return { verified: data.data?.status === "successful", amount: (data.data?.amount ?? 0) * 100 as number }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { subscriptionId, reference } = await req.json()
    if (!subscriptionId || !reference) {
      return NextResponse.json({ error: "subscriptionId and reference required" }, { status: 400 })
    }

    const subRows = await d1Query("SELECT * FROM subscriptions WHERE id = ? LIMIT 1", [subscriptionId], nativeDB)
    const sub = (subRows?.results?.[0] ?? null) as Record<string, unknown> | null
    if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 })

    // Only the seller who initiated this subscription can activate it.
    if (String(sub.user_id ?? "") !== auth.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }
    if (String(sub.status ?? "") === "active") {
      return NextResponse.json({ success: true, alreadyActive: true })
    }

    // provider is whatever was stashed on the subscription row at
    // create-pending time — falls back to Paystack for any pre-existing
    // rows created before Flutterwave support existed.
    const provider = String(sub.payment_provider ?? "paystack") === "flutterwave" ? "flutterwave" : "paystack"
    const { verified } = provider === "flutterwave"
      ? await verifyFlutterwave(reference)
      : await verifyPaystack(reference)
    if (!verified) {
      return NextResponse.json({ error: "Payment not verified yet" }, { status: 409 })
    }

    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
    const plan = String(sub.plan ?? "")

    await d1Query(
      `UPDATE subscriptions SET status = ?, payment_reference = ?, payment_provider = ?, activated_at = ? WHERE id = ?`,
      ["active", reference, provider, now, subscriptionId],
      nativeDB,
    )
    await d1Query(
      `UPDATE users SET plan = ?, plan_expires_at = ? WHERE uid = ?`,
      [plan, expiresAt, auth.uid],
      nativeDB,
    )
    await d1Query(
      `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        auth.uid,
        "system",
        "🎉 Subscription Activated!",
        `Your ${plan} plan is now active.`,
        "/dashboard/seller",
        0,
        now,
      ],
      nativeDB,
    )

    return NextResponse.json({ success: true, plan })
  } catch (err: any) {
    console.error("[POST /api/subscriptions/activate]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
