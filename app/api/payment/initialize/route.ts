// app/api/payment/initialize/route.ts
// ─────────────────────────────────────────────────────────────────
// Universal payment initialization endpoint.
// Handles: order escrow, subscription, boost — all purposes.
// Provider logic is handled server-side here (secret keys safe).
// ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { verifyBuyNowDraft, verifyCartPayment } from "@/lib/server/order-pricing"
import { getPlatformSettings } from "@/src/services/platformSettings"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

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
export async function POST(req: NextRequest, context: RouteContext) {
  // Only signed-in users can start a payment. Previously anyone could hit this
  // endpoint directly with any amount.
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error
  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    const { provider, email, reference, callbackUrl, channel, escrow, subaccountId } = body
    let { amount, metadata } = body as { amount: number; metadata?: Record<string, any> }

    if (!provider || !amount || !email || !reference) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    metadata = { ...(metadata ?? {}) }
    // The payer is always the session user, whatever the client claims.
    metadata.userId = auth.uid

    const purpose = String(metadata.purpose ?? "")

    // ── Buy Now order: verify price, fees and delivery on the server, and
    // replace the client's draft with a server-derived one. The rewritten
    // draft is what the gateway stores, so post-payment routes and webhooks
    // read money fields the browser never controlled.
    if (purpose === "order" && metadata.orderDraft && !metadata.isLayawayDeposit) {
      const checked = await verifyBuyNowDraft(metadata.orderDraft, {
        buyerUid: auth.uid,
        claimedTotalKobo: amount,
        nativeDB,
      })
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: checked.status })
      }
      metadata.orderDraft = checked.draft
      amount = Math.max(amount, checked.expectedTotalKobo)
    }

    // ── Cart order: same idea, driven by the pending_payments row the cart
    // modal wrote just before calling this route.
    if (purpose === "cart_order") {
      const res: any = await d1Query(
        "SELECT * FROM pending_payments WHERE reference = ? LIMIT 1",
        [reference],
        nativeDB,
      )
      const payment = (res?.results ?? [])[0] as Record<string, unknown> | undefined
      if (!payment) return NextResponse.json({ error: "Cart payment not found" }, { status: 404 })
      if (String(payment.user_id ?? "") !== auth.uid) {
        return NextResponse.json({ error: "Not authorised" }, { status: 403 })
      }
      let meta: any = {}
      try { meta = JSON.parse(String(payment.metadata ?? "{}")) } catch { /* empty */ }

      const checked = await verifyCartPayment(meta.cartItems, {
        buyerUid: auth.uid,
        claimedTotalKobo: amount,
        buyerState: String(meta.deliveryState ?? meta.buyerState ?? ""),
        nativeDB,
      })
      if (!checked.ok) {
        return NextResponse.json({ error: checked.error }, { status: checked.status })
      }
      metadata.zmxExpected = checked.pinned
      amount = Math.max(amount, checked.pinned.totalKobo)
    }

    // ── Subscription: the price is whatever the admin has set for this
    // plan right now, never the client's priceKobo. A stale/forged price
    // is simply overridden rather than rejected, since there's no user
    // draft to invalidate here — just a plan name.
    if (purpose === "subscription") {
      const plan = String(metadata.plan ?? "")
      if (plan !== "starter" && plan !== "pro") {
        return NextResponse.json({ error: "Unknown plan" }, { status: 400 })
      }
      const settings = await getPlatformSettings() as any
      const planPrice = plan === "starter" ? Number(settings.planStarterPrice) : Number(settings.planProPrice)
      if (!(planPrice > 0)) {
        return NextResponse.json({ error: "This plan is not currently available" }, { status: 409 })
      }
      amount = planPrice
    }

    // ── Boost / Ad Boost: same idea as subscriptions — the price is
    // whatever the admin has configured right now, not the client's
    // amount. This is defense-in-depth (the authoritative check is in
    // /api/boosts/activate, which compares what was ACTUALLY paid), but
    // fixing it here too means the checkout page itself shows and charges
    // the correct amount rather than a client-forged one that would just
    // get rejected on redirect back.
    if (purpose === "boost") {
      const settings = await getPlatformSettings() as any
      const planTitle = String(metadata.plan ?? "")
      const isAdBoost = !!metadata.adBoostId
      const planPrice = isAdBoost
        ? (planTitle === "combined" ? Number(settings.adBoostPriceCombined) : Number(settings.adBoostPriceStandard))
        : planTitle === "Category Top" ? Number(settings.boostCategoryTop)
        : planTitle === "Premium"      ? Number(settings.boostPremium)
        : planTitle === "Standard"     ? Number(settings.boostStandard)
        : null
      if (!planPrice || !(planPrice > 0)) {
        return NextResponse.json({ error: "Unknown boost plan" }, { status: 400 })
      }
      amount = planPrice
    }

    let result: { redirectUrl: string }

    if (provider === "paystack") {
      result = await initializePaystack({ amount, email, reference, metadata: metadata!, callbackUrl, channel })
    } else if (provider === "flutterwave") {
      result = await initializeFlutterwave({ amount, email, reference, metadata: metadata!, callbackUrl, escrow, subaccountId })
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
