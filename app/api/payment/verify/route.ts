// app/api/payment/verify/route.ts
// ─────────────────────────────────────────────────────────────────
// Universal payment verification endpoint.
// Called after redirect from Paystack/Flutterwave, or by admin for manual.
// ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

// ── Paystack verify ───────────────────────────────────────────────
async function verifyPaystack(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()

  if (!data.status) throw new Error(data.message || "Paystack verification failed")

  const tx = data.data
  return {
    verified: tx.status === "success",
    amount: tx.amount,           // kobo
    metadata: tx.metadata,
  }
}

// ── Flutterwave verify ────────────────────────────────────────────
async function verifyFlutterwave(reference: string) {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")

  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  )
  const data = await res.json()

  if (data.status !== "success") throw new Error(data.message || "Flutterwave verification failed")

  const tx = data.data
  // rave_escrow_tx in the meta object: 1 -> still held in escrow,
  // "SETTLED" -> already released via /transactions/escrow/settle.
  // Surface this so callers (e.g. the webhook / order activation flow)
  // know whether this was an escrow transaction and its current state,
  // without needing a second lookup.
  const escrowFlag = tx.meta?.rave_escrow_tx ?? tx.meta_data?.find?.(
    (m: any) => m.metaname === "rave_escrow_tx",
  )?.metavalue
  const escrowStatus: "held" | "settled" | undefined =
    escrowFlag === "SETTLED" ? "settled" : escrowFlag ? "held" : undefined
  return {
    verified: tx.status === "successful",
    amount: tx.amount * 100,     // convert Naira → kobo
    metadata: tx.meta,
    flwTransactionId: tx.id as number | undefined,
    escrowStatus,
  }
}

// ── Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { provider, reference } = await req.json()

    if (!provider || !reference) {
      return NextResponse.json({ error: "Missing provider or reference" }, { status: 400 })
    }

    let result: {
      verified: boolean
      amount?: number
      metadata?: unknown
      flwTransactionId?: number
      escrowStatus?: "held" | "settled"
    }

    if (provider === "paystack") {
      result = await verifyPaystack(reference)
    } else if (provider === "flutterwave") {
      result = await verifyFlutterwave(reference)
    } else if (provider === "manual") {
      // Manual verification is done via adminConfirmPayment, not here
      return NextResponse.json({
        verified: false,
        message: "Manual payments are confirmed by admin in /admin/payments",
      })
    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (err: any) {
    console.error("Payment verify error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
