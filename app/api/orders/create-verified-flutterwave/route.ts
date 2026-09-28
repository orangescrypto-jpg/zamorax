// app/api/orders/create-verified-flutterwave/route.ts
// Flutterwave twin of create-verified-paystack: verifies the payment with
// Flutterwave, then hands off to the shared fulfilment helper (auth, server
// price check, paid-amount check, single-winner order creation).
//
// Also captures Flutterwave's numeric transaction id on the order — needed
// later for /transactions/escrow/settle, which takes Flutterwave's own id
// rather than our tx_ref.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { findOrdersByPaymentReference } from "@/lib/server/order-lookup"
import { fulfilVerifiedPayment, parseDraft } from "@/lib/server/verified-order"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error
  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    const reference = String(body?.reference ?? "")
    if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 })

    const existing = await findOrdersByPaymentReference(reference, nativeDB)
    if (existing.length) {
      return NextResponse.json({ success: true, orderId: existing[0].id, alreadyExisted: true })
    }

    const secretKey = process.env.FLW_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: "Flutterwave secret key not configured" }, { status: 500 })

    const verifyRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    )
    const verifyData = await verifyRes.json()
    if (verifyData.status !== "success" || verifyData.data?.status !== "successful") {
      return NextResponse.json({ error: "Payment not verified — no order was created." }, { status: 402 })
    }

    const tx = verifyData.data
    const metaDraft = (tx?.meta as Record<string, unknown> | undefined)?.orderDraft
      ?? (tx?.meta_data as any[])?.find?.((m: any) => m.metaname === "orderDraft")?.metavalue
    const metaUserId = (tx?.meta as Record<string, unknown> | undefined)?.userId

    const out = await fulfilVerifiedPayment({
      provider: "flutterwave",
      reference,
      // Flutterwave reports naira; the rest of the system works in kobo.
      paidKobo: Math.round(Number(tx?.amount ?? 0) * 100),
      gatewayDraft: parseDraft(metaDraft),
      clientDraft: parseDraft(body?.orderDraft),
      gatewayUserId: metaUserId ? String(metaUserId) : null,
      sessionUid: auth.uid,
      flwTransactionId: tx?.id ?? null,
      nativeDB,
    })
    return NextResponse.json(out.body, { status: out.status })
  } catch (err: any) {
    console.error("create-verified-flutterwave error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
