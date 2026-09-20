// app/api/orders/create-layaway/route.ts
// Creates an order plus its layaway_plans row after verifying the deposit
// payment with Paystack or Flutterwave. Mirrors
// create-verified-paystack/create-verified-flutterwave but the order goes
// to status "layaway_active" instead of "escrow_held" -- no shipping,
// delivery, or fulfillment happens until the plan reaches 100% paid.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { d1Query } from "@/lib/d1"
import { getPlatformSettings } from "@/src/services/platformSettings"
import { computeRequiredDeposit } from "@/lib/layaway-deposit"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function verifyPaystack(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()
  if (!data.status || data.data?.status !== "success") return null
  return { amount: data.data.amount as number }
}

async function verifyFlutterwave(reference: string) {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  )
  const data = await res.json()
  if (data.status !== "success" || data.data?.status !== "successful") return null
  return { amount: (data.data.amount as number) * 100 }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    const { reference, provider, orderDraft } = body

    if (!reference || !provider) {
      return NextResponse.json({ error: "Missing reference or provider" }, { status: 400 })
    }
    if (provider !== "paystack" && provider !== "flutterwave") {
      return NextResponse.json({ error: "Unsupported provider for layaway" }, { status: 400 })
    }

    const platformSettings = await getPlatformSettings()
    if (!platformSettings.layawayEnabled) {
      return NextResponse.json({ error: "Layaway is not currently available" }, { status: 403 })
    }

    // Idempotent, same pattern as create-verified-paystack.
    const existingPlan = await d1Query(
      "SELECT id, order_id FROM layaway_plans WHERE id IN (SELECT plan_id FROM layaway_payments WHERE provider_ref = ?) LIMIT 1",
      [reference],
      nativeDB,
    )
    if (existingPlan?.results?.[0]) {
      const row = existingPlan.results[0] as { id: string; order_id: string }
      return NextResponse.json({ success: true, planId: row.id, orderId: row.order_id, alreadyExisted: true })
    }

    if (!orderDraft || typeof orderDraft !== "object") {
      return NextResponse.json({ error: "Missing order draft" }, { status: 400 })
    }

    const {
      buyerId, buyerName, sellerId, sellerName, sellerStoreName,
      listingId, itemTitle, itemImage, totalAmount, platformFee, sellerPayout,
      deliveryStreet, deliveryCity, deliveryState, deliveryLGA, deliveryMethod,
      sellerState, buyerState, itemPrice, qty,
    } = orderDraft

    // Quantity is part of one plan, not separate plans -- buyer picks how
    // many units of this one listing they want on layaway, and the
    // deposit/total below already reflect that (unitPrice * qty), same as
    // BuyNowModal's own bulk-qty handling. Still one seller, one plan, one
    // deadline -- never split across multiple listings or into cart.
    const orderQty = Number(qty) > 0 ? Math.floor(Number(qty)) : 1

    if (!buyerId || !sellerId || !listingId || !totalAmount) {
      return NextResponse.json({ error: "Order draft missing required fields" }, { status: 400 })
    }

    // Verify the deposit payment actually happened.
    const verified = provider === "paystack"
      ? await verifyPaystack(reference)
      : await verifyFlutterwave(reference)
    if (!verified) {
      return NextResponse.json({ error: "Payment not verified -- no layaway plan was created." }, { status: 402 })
    }

    // Pull the listing's layaway config, clamped by platform bounds.
    const listingRows = await d1Query(
      "SELECT layaway_enabled, layaway_min_deposit_type, layaway_min_deposit_percent, layaway_min_deposit_flat_kobo, layaway_max_days, stock_qty FROM listings WHERE id = ? LIMIT 1",
      [listingId],
      nativeDB,
    )
    const listing = listingRows?.results?.[0] as
      | {
          layaway_enabled?: number; layaway_min_deposit_type?: string;
          layaway_min_deposit_percent?: number; layaway_min_deposit_flat_kobo?: number;
          layaway_max_days?: number; stock_qty?: number;
        }
      | undefined
    if (!listing || !listing.layaway_enabled) {
      return NextResponse.json({ error: "This listing does not offer layaway" }, { status: 403 })
    }
    if (listing.stock_qty != null && listing.stock_qty < orderQty) {
      return NextResponse.json({ error: "Not enough stock available for the quantity requested" }, { status: 409 })
    }

    const { depositType, depositPercent, requiredDepositKobo, maxDays } = computeRequiredDeposit(
      listing, Number(totalAmount), platformSettings,
    )

    if (verified.amount < requiredDepositKobo) {
      return NextResponse.json(
        {
          error: depositType === "flat"
            ? `Deposit too low. Minimum required is ${requiredDepositKobo} kobo.`
            : `Deposit too low. Minimum required is ${requiredDepositKobo} kobo (${depositPercent}%).`,
        },
        { status: 402 },
      )
    }

    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000).toISOString()
    const orderId = crypto.randomUUID()
    const planId = crypto.randomUUID()

    await AdminService.setDoc("orders", orderId, {
      id: orderId, buyer_id: buyerId, buyer_name: buyerName ?? "",
      seller_id: sellerId, seller_name: sellerName ?? "", seller_store_name: sellerStoreName ?? "",
      listing_id: listingId, item_title: itemTitle ?? "Order", item_image: itemImage ?? "",
      total_amount: totalAmount, platform_fee: platformFee ?? 0, seller_payout: sellerPayout ?? 0,
      delivery_street: deliveryStreet ?? "", delivery_city: deliveryCity ?? "",
      delivery_state: deliveryState ?? "", delivery_lga: deliveryLGA ?? "",
      delivery_method: deliveryMethod ?? "meetup",
      seller_state: sellerState ?? "", buyer_state: buyerState ?? "",
      item_price: itemPrice ?? 0,
      line_items: JSON.stringify([{ listingId, title: itemTitle, qty: orderQty, unitPrice: itemPrice ?? 0 }]),
      layaway_plan_id: planId,
      status: "layaway_active", escrow_status: "held",
      order_type: "purchase", payment_reference: reference, payment_provider: provider,
    })

    await d1Query(
      `INSERT INTO layaway_plans (
        id, order_id, listing_id, buyer_id, seller_id, total_amount, amount_paid,
        deposit_percent, status, forfeit_percent, price_locked_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [
        planId, orderId, listingId, buyerId, sellerId, totalAmount, verified.amount,
        depositPercent ?? Math.round((requiredDepositKobo / Number(totalAmount)) * 100),
        platformSettings.layawayDefaultForfeitPercent, now, expiresAt, now, now,
      ],
      nativeDB,
    )

    await d1Query(
      `INSERT INTO layaway_payments (id, plan_id, amount, provider, provider_ref, status, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', ?, ?)`,
      [crypto.randomUUID(), planId, verified.amount, provider, reference, now, now],
      nativeDB,
    )

    try {
      await d1Query(
        `UPDATE listings SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty IS NOT NULL AND stock_qty >= ?`,
        [orderQty, listingId, orderQty],
        nativeDB,
      )
    } catch (err) {
      console.error("create-layaway: stock decrement failed:", err)
    }

    try {
      const { sendPushNotification } = await import("@/src/services/webPush")
      await sendPushNotification({
        userId: sellerId,
        type: "account_activity",
        title: "New layaway plan started",
        body: `${buyerName || "A buyer"} started a layaway plan for "${itemTitle}".`,
        link: `/dashboard/seller/orders/${orderId}`,
        nativeDB,
      })
    } catch (err) {
      console.error("create-layaway: seller notification failed (non-fatal):", err)
    }

    return NextResponse.json({ success: true, planId, orderId })
  } catch (err: any) {
    console.error("create-layaway error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
