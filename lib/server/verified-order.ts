// lib/server/verified-order.ts
// ─────────────────────────────────────────────────────────────────
// The ONE place a paid Buy Now order becomes an order row. Used by
// create-verified-paystack, create-verified-flutterwave and the Flutterwave
// webhook fallback, which previously each carried their own copy that trusted
// totalAmount / platformFee / sellerPayout from the draft.
//
// Guarantees:
//  * the draft comes from the gateway's own stored metadata (written by
//    /api/payment/initialize after server-side price verification), and the
//    browser-supplied draft is only a fallback that gets re-verified;
//  * the amount the gateway actually collected covers the order total;
//  * a signed-in caller can only fulfil their own payment;
//  * money fields written to the order are the server-derived ones;
//  * exactly one caller creates the order and runs stock/referral side effects
//    (claim row in kv_store), even when the buyer's browser and the webhook
//    race each other.
// ─────────────────────────────────────────────────────────────────

import { AdminService } from "@/src/services/admin"
import { d1Query } from "@/lib/d1"
import { decrementStock } from "@/lib/stockManagement"
import { ReferralsService } from "@/src/services/referrals"
import { findOrdersByPaymentReference } from "@/lib/server/order-lookup"
import { paidCoversTotal, verifyBuyNowDraft } from "@/lib/server/order-pricing"

export interface FulfilArgs {
  provider: "paystack" | "flutterwave"
  reference: string
  paidKobo: number
  gatewayDraft: Record<string, any> | null
  clientDraft: Record<string, any> | null
  gatewayUserId?: string | null
  sessionUid: string | null // null when called from a signature-verified webhook
  flwTransactionId?: number | null
  nativeDB?: unknown
}
export interface FulfilResult { status: number; body: Record<string, unknown> }

const rows = (r: unknown) => (((r as any)?.results ?? []) as Record<string, unknown>[])

export function parseDraft(raw: unknown): Record<string, any> | null {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw
    return v && typeof v === "object" ? (v as Record<string, any>) : null
  } catch { return null }
}

export async function fulfilVerifiedPayment(a: FulfilArgs): Promise<FulfilResult> {
  const { provider, reference, nativeDB } = a

  const existing = await findOrdersByPaymentReference(reference, nativeDB)
  if (existing.length) return { status: 200, body: { success: true, orderId: existing[0].id, alreadyExisted: true } }

  const fromGateway = !!a.gatewayDraft
  const draft = a.gatewayDraft ?? a.clientDraft
  if (!draft) return { status: 400, body: { error: "Missing order draft" } }

  const buyerId = String(draft.buyerId ?? "")
  if (!buyerId) return { status: 400, body: { error: "Order draft missing required fields" } }
  if (a.sessionUid) {
    if (buyerId !== a.sessionUid) return { status: 403, body: { error: "This payment belongs to a different account." } }
    if (a.gatewayUserId && a.gatewayUserId !== a.sessionUid) {
      return { status: 403, body: { error: "This payment belongs to a different account." } }
    }
  }

  // Trusted only if the server itself stamped it at initialize time, and it
  // came back from the gateway (not from the browser). Anything else is
  // re-verified against live listing data.
  let safe: Record<string, any>
  if (fromGateway && draft.zmxVerified === true) {
    safe = draft
    if (!paidCoversTotal(a.paidKobo, Number(draft.totalAmount ?? 0))) {
      console.error("[verified-order] paid amount below order total", { reference, paid: a.paidKobo, total: draft.totalAmount })
      return { status: 402, body: { error: "Amount paid does not cover this order. Contact support with your payment reference." } }
    }
  } else {
    const checked = await verifyBuyNowDraft(draft, { buyerUid: buyerId, claimedTotalKobo: a.paidKobo, nativeDB })
    if (!checked.ok) {
      console.error("[verified-order] draft rejected", { reference, error: checked.error })
      return { status: checked.status === 403 ? 403 : 409, body: { error: `${checked.error} Contact support with your payment reference.` } }
    }
    safe = checked.draft
    if (!paidCoversTotal(a.paidKobo, checked.expectedTotalKobo)) {
      return { status: 402, body: { error: "Amount paid does not cover this order. Contact support with your payment reference." } }
    }
  }

  // ── claim: only one caller proceeds ──
  const claimKey = `order_claim:${reference}`
  const token = crypto.randomUUID()
  await d1Query(
    "INSERT OR IGNORE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)",
    [claimKey, token, new Date().toISOString()],
    nativeDB,
  )
  const claim = rows(await d1Query("SELECT value FROM kv_store WHERE key = ? LIMIT 1", [claimKey], nativeDB))[0]
  if (String(claim?.value) !== token) {
    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, 500))
      const now = await findOrdersByPaymentReference(reference, nativeDB)
      if (now.length) return { status: 200, body: { success: true, orderId: now[0].id, alreadyExisted: true } }
    }
    return { status: 202, body: { success: true, processing: true } }
  }

  const li = Array.isArray(safe.lineItems) ? safe.lineItems[0] : null
  const orderQty = Number(li?.qty) > 0 ? Math.floor(Number(li.qty)) : 1
  const orderId = crypto.randomUUID()

  try {
    await AdminService.setDoc("orders", orderId, {
      id: orderId, buyer_id: buyerId, buyer_name: safe.buyerName ?? "",
      seller_id: safe.sellerId, seller_name: safe.sellerName ?? "", seller_store_name: safe.sellerStoreName ?? "",
      listing_id: safe.listingId, item_title: safe.itemTitle ?? "Order", item_image: safe.itemImage ?? "",
      total_amount: safe.totalAmount ?? 0, platform_fee: safe.platformFee ?? 0, seller_payout: safe.sellerPayout ?? 0,
      delivery_street: safe.deliveryStreet ?? "", delivery_city: safe.deliveryCity ?? "",
      delivery_state: safe.deliveryState ?? "", delivery_lga: safe.deliveryLGA ?? "",
      delivery_phone: safe.deliveryPhone ?? "",
      delivery_method: safe.deliveryMethod ?? "meetup",
      seller_state: safe.sellerState ?? "", buyer_state: safe.buyerState ?? "",
      item_price: safe.itemPrice ?? 0,
      line_items: JSON.stringify(Array.isArray(safe.lineItems) ? safe.lineItems : []),
      selected_color: safe.selectedColor ?? null, selected_size: safe.selectedSize ?? null,
      status: "escrow_held", escrow_status: "held", escrow_held_at: new Date().toISOString(),
      order_type: "purchase", payment_reference: reference, payment_provider: provider,
      ...(provider === "flutterwave" ? { flw_transaction_id: a.flwTransactionId ?? null } : {}),
      is_offer_order: !!safe.isOfferOrder, offer_id: safe.offerId ?? null, original_price: safe.originalPrice ?? null,
    })
  } catch (err) {
    // Release the claim so a retry can succeed instead of being stuck "processing".
    await d1Query("DELETE FROM kv_store WHERE key = ?", [claimKey], nativeDB).catch(() => {})
    throw err
  }

  if (safe.isOfferOrder && safe.listingId) {
    try {
      const { OffersService } = await import("@/src/services")
      await OffersService.markOfferUsed(safe.listingId, buyerId)
    } catch (err) { console.error("[verified-order] markOfferUsed failed (non-fatal):", err) }
  }
  try { await decrementStock(safe.listingId, orderQty, nativeDB) }
  catch (err) { console.error("[verified-order] stock decrement failed:", err) }
  try { await ReferralsService.triggerFirstOrderBonus(buyerId) }
  catch (err) { console.error("[verified-order] referral bonus failed (non-fatal):", err) }

  return { status: 200, body: { success: true, orderId } }
}
