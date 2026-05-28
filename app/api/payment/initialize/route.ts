// app/api/payment/initialize/route.ts
// ─────────────────────────────────────────────────────────────────
// Universal payment initialization endpoint.
// Handles: order escrow, subscription, boost — all purposes.
// Provider logic is handled server-side here (secret keys safe).
// ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

// ── Paystack helper ───────────────────────────────────────────────
async function initializePaystack(params: {
  amount: number
  email: string
  reference: string
  metadata: Record<string, unknown>
  callbackUrl: string
}): Promise<{ redirectUrl: string }> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount:       params.amount,
      email:        params.email,
      reference:    params.reference,
      callback_url: params.callbackUrl,
      currency:     "NGN",
      metadata:     params.metadata,
      channels:     ["card", "bank", "ussd", "bank_transfer"],
    }),
  })

  const data = await res.json()
  if (!data.status) throw new Error(data.message || "Paystack initialization failed")
  return { redirectUrl: data.data.authorization_url }
}

// ── Flutterwave helper ────────────────────────────────────────────
async function initializeFlutterwave(params: {
  amount: number
  email: string
  reference: string
  metadata: Record<string, unknown>
  callbackUrl: string
}): Promise<{ redirectUrl: string }> {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")

  const amountNaira = params.amount / 100  // Flutterwave uses Naira not kobo

  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref:       params.reference,
      amount:       amountNaira,
      currency:     "NGN",
      redirect_url: params.callbackUrl,
      customer: {
        email: params.email,
      },
      meta:         params.metadata,
    }),
  })

  const data = await res.json()
  if (data.status !== "success") throw new Error(data.message || "Flutterwave initialization failed")
  return { redirectUrl: data.data.link }
}

// ── Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, amount, email, reference, metadata, callbackUrl } = body

    if (!provider || !amount || !email || !reference) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let result: { redirectUrl: string }

    if (provider === "paystack") {
      result = await initializePaystack({ amount, email, reference, metadata, callbackUrl })
    } else if (provider === "flutterwave") {
      result = await initializeFlutterwave({ amount, email, reference, metadata, callbackUrl })
    } else if (provider === "manual") {
      // Manual provider: no redirect — client handles UI
      // This endpoint is not called for manual, but handle gracefully
      return NextResponse.json({
        provider: "manual",
        reference,
        message: "Manual payment — show bank details to user",
      })
    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    return NextResponse.json({ ...result, reference, provider })

  } catch (err: any) {
    console.error("Payment initialize error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
