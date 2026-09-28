// app/api/orders/create-verified-paystack/route.ts
// Creates the order row for a single-item (Buy Now) Paystack purchase, only
// AFTER Paystack confirms the payment — and only if what was actually paid
// covers a server-verified price for the signed-in buyer.
//
// Previously this route had no auth and copied totalAmount / platformFee /
// sellerPayout from the request body, so a ₦100 payment could open an order
// claiming a ₦500,000 payout. All of that now lives in
// lib/server/verified-order.ts, shared with the Flutterwave route and webhook.
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

    // Idempotent — buyer refreshing the orders page must not create a second order.
    const existing = await findOrdersByPaymentReference(reference, nativeDB)
    if (existing.length) {
      return NextResponse.json({ success: true, orderId: existing[0].id, alreadyExisted: true })
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: "Paystack secret key not configured" }, { status: 500 })

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const verifyData = await verifyRes.json()
    if (!verifyData.status || verifyData.data?.status !== "success") {
      return NextResponse.json({ error: "Payment not verified — no order was created." }, { status: 402 })
    }

    const meta = verifyData.data?.metadata ?? {}
    const out = await fulfilVerifiedPayment({
      provider: "paystack",
      reference,
      paidKobo: Number(verifyData.data?.amount ?? 0),
      gatewayDraft: parseDraft(meta.orderDraft),
      clientDraft: parseDraft(body?.orderDraft),
      gatewayUserId: meta.userId ? String(meta.userId) : null,
      sessionUid: auth.uid,
      nativeDB,
    })
    return NextResponse.json(out.body, { status: out.status })
  } catch (err: any) {
    console.error("create-verified-paystack error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
