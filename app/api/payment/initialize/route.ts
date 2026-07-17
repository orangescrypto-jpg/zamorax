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
  channel?: "card" | "bank"
}): Promise<{ redirectUrl: string }> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")

  // "card" -> card-only checkout ("Pay with Card" option).
  // "bank" -> bank transfer / USSD / direct bank debit only ("Bank (Online)").
  // Omitted -> all channels (single-Paystack-method setups with no split).
  const channels =
    params.channel === "card" ? ["card"]
    : params.channel === "bank" ? ["bank", "bank_transfer", "ussd"]
    : ["card", "bank", "ussd", "bank_transfer"]

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
      channels,
    }),
  })

  const data = await res.json()
  if (!data.status) throw new Error(data.message || "Paystack initialization failed")
  return { redirectUrl: data.data.authorization_url }
}

// ── Flutterwave helper ────────────────────────────────────────────
// `escrow: true` (order payments only) flags the transaction so Flutterwave
// holds the funds instead of settling them on the normal schedule — see
// src/services/providers/flutterwave/payment.ts for the full rationale.
// `subaccountId`, if provided, splits the escrowed funds to that seller's
// Flutterwave subaccount at settle time instead of the whole amount sitting
// under the platform account.
async function initializeFlutterwave(params: {
  amount: number
  email: string
  reference: string
  metadata: Record<string, unknown>
  callbackUrl: string
  escrow?: boolean
  subaccountId?: string
}): Promise<{ redirectUrl: string }> {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")

  const amountNaira = params.amount / 100  // Flutterwave uses Naira not kobo

  const meta: Record<string, unknown> = { ...params.metadata }
  const metaArray: { metaname: string; metavalue: string | number }[] = []
  if (params.escrow) {
    // Required exact shape for Flutterwave's escrow feature — see
    // https://developer.flutterwave.com/v2.0/docs/escrow-payments
    metaArray.push({ metaname: "rave_escrow_tx", metavalue: 1 })
  }

  const body: Record<string, unknown> = {
    tx_ref:       params.reference,
    amount:       amountNaira,
    currency:     "NGN",
    redirect_url: params.callbackUrl,
    customer: {
      email: params.email,
    },
    meta,
  }
  if (metaArray.length) body.meta = metaArray.reduce(
    (acc, m) => ({ ...acc, [m.metaname]: m.metavalue }), meta,
  )
  // Flutterwave's escrow-metadata contract expects the array form on some
  // API versions and a flattened object on others — send both shapes
  // defensively so this keeps working regardless of which v3 revision the
  // account is on. The flattened object above is read by most integrations;
  // the array form below is the one documented for escrow specifically.
  if (metaArray.length) (body as any).meta_array = metaArray

  if (params.subaccountId) {
    body.subaccounts = [{ id: params.subaccountId }]
  }

  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (data.status !== "success") throw new Error(data.message || "Flutterwave initialization failed")
  return { redirectUrl: data.data.link }
}

// ── Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, amount, email, reference, metadata, callbackUrl, channel, escrow, subaccountId } = body

    if (!provider || !amount || !email || !reference) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    let result: { redirectUrl: string }

    if (provider === "paystack") {
      result = await initializePaystack({ amount, email, reference, metadata, callbackUrl, channel })
    } else if (provider === "flutterwave") {
      result = await initializeFlutterwave({ amount, email, reference, metadata, callbackUrl, escrow, subaccountId })
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
