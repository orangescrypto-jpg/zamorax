// app/api/orders/create-layaway-manual/route.ts
// Manual bank transfer path for starting a layaway plan. Unlike Paystack
// and Flutterwave, a manual transfer cannot be verified automatically --
// an admin has to see the buyer's proof of payment and confirm it by
// hand. So this route creates the order and the layaway plan right away,
// both in a "pending admin confirmation" state, exactly the way a normal
// manual-payment order is created before admin confirmation (see
// app/api/cart/create-pending-orders and app/api/payment/confirm). The
// plan only becomes active, and its deadline only starts counting, once
// an admin confirms the deposit via
// app/api/admin/layaway-manual-confirm/route.ts.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"
import { d1Query } from "@/lib/d1"
import { getPlatformSettings } from "@/src/services/platformSettings"
import { ManualPaymentService } from "@/src/services/providers/manual/payment"
import { computeRequiredDeposit } from "@/lib/layaway-deposit"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const platformSettings = await getPlatformSettings()
    if (!platformSettings.layawayEnabled) {
      return NextResponse.json({ error: "Layaway is not currently available" }, { status: 403 })
    }
    if (!platformSettings.manualPaymentEnabled) {
      return NextResponse.json({ error: "Manual bank transfer is not currently available" }, { status: 403 })
    }

    const body = await req.json()
    const {
      sellerId, sellerName, sellerStoreName,
      listingId, itemTitle, itemImage, itemPrice, qty, buyerFee,
      deliveryStreet, deliveryCity, deliveryState, deliveryLGA, deliveryMethod,
      sellerState, buyerState, buyerName,
    } = body

    if (!sellerId || !listingId || !itemPrice) {
      return NextResponse.json({ error: "Missing required order fields" }, { status: 400 })
    }

    const orderQty = Number(qty) > 0 ? Math.floor(Number(qty)) : 1
    const totalAmount = Number(itemPrice) * orderQty

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

    const { depositPercent, requiredDepositKobo: itemDepositKobo, maxDays } = computeRequiredDeposit(
      listing, totalAmount, platformSettings,
    )
    const buyerFeeKobo = Number(buyerFee) > 0 ? Math.floor(Number(buyerFee)) : 0
    const depositKobo = itemDepositKobo + buyerFeeKobo

    const orderId = crypto.randomUUID()
    const planId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Deadline is intentionally not set yet -- it only starts once admin
    // confirms the deposit was actually received, so the buyer is never
    // penalised for however long the manual review takes.
    await AdminService.setDoc("orders", orderId, {
      id: orderId, buyer_id: auth.uid, buyer_name: buyerName ?? "",
      seller_id: sellerId, seller_name: sellerName ?? "", seller_store_name: sellerStoreName ?? "",
      listing_id: listingId, item_title: itemTitle ?? "Order", item_image: itemImage ?? "",
      total_amount: totalAmount, item_price: itemPrice ?? 0,
      delivery_street: deliveryStreet ?? "", delivery_city: deliveryCity ?? "",
      delivery_state: deliveryState ?? "", delivery_lga: deliveryLGA ?? "",
      delivery_method: deliveryMethod ?? "meetup",
      seller_state: sellerState ?? "", buyer_state: buyerState ?? "",
      line_items: JSON.stringify([{ listingId, title: itemTitle, qty: orderQty, unitPrice: itemPrice ?? 0 }]),
      layaway_plan_id: planId,
      status: "layaway_pending_confirmation", escrow_status: "held",
      order_type: "purchase", payment_provider: "manual",
    })

    await d1Query(
      `INSERT INTO layaway_plans (
        id, order_id, listing_id, buyer_id, seller_id, total_amount, amount_paid,
        deposit_percent, buyer_fee_kobo, status, price_locked_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending_admin_confirmation', ?, ?, ?, ?)`,
      [planId, orderId, listingId, auth.uid, sellerId, totalAmount, depositPercent ?? Math.round((itemDepositKobo / totalAmount) * 100), buyerFeeKobo, now, now, now, now],
      nativeDB,
    )

    const bankDetails = await ManualPaymentService.getBankDetails()

    await d1Query(
      `INSERT INTO layaway_payments (id, plan_id, amount, provider, provider_ref, status, paid_at, created_at)
       VALUES (?, ?, ?, 'manual', ?, 'pending_admin_review', ?, ?)`,
      [crypto.randomUUID(), planId, depositKobo, `${planId}-deposit`, now, now],
      nativeDB,
    )

    return NextResponse.json({
      success: true,
      orderId,
      planId,
      depositKobo,
      maxDays,
      bankDetails: bankDetails ?? {
        bankName: "Bank name not set, contact admin",
        accountNumber: "Not configured",
        accountName: "Not configured",
      },
    })
  } catch (err: any) {
    console.error("create-layaway-manual error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
