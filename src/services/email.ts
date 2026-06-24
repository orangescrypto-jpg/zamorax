// src/services/email.ts
// Helper to send emails from any server-side API route or Server Action.
// Calls /api/email/send internally — keeps all Resend logic in one place.
//
// Usage:
//   import { sendEmail } from "@/src/services/email"
//
//   await sendEmail("order_confirmed", buyer.email, {
//     buyerName:   buyer.fullName,
//     itemTitle:   order.itemTitle,
//     orderId:     order.id,
//     totalAmount: formatPrice(order.totalAmount),
//     sellerName:  order.sellerName,
//   })
//
// Fire-and-forget — errors are logged but never thrown (email failure
// should never break the main order flow).

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://zamorax.com"

export async function sendEmail(
  type: string,
  to:   string | string[],
  data: Record<string, any>
): Promise<void> {
  try {
    const res = await fetch(`${APP_URL}/api/email/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, to, data }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error(`[sendEmail] Failed (${type}):`, err)
    }
  } catch (err) {
    // Never let email failure break the calling flow
    console.error(`[sendEmail] Network error (${type}):`, err)
  }
}

// ── Typed helpers — import these in your API routes ────────────────────────────

export const Emails = {

  orderConfirmed: (to: string, data: {
    buyerName:   string
    itemTitle:   string
    orderId:     string
    totalAmount: string
    sellerName:  string
  }) => sendEmail("order_confirmed", to, data),

  escrowReleased: (to: string, data: {
    sellerName:     string
    itemTitle:      string
    orderId:        string
    grossAmount:    string
    commissionAmt:  string
    commissionPct:  string
    arbitrationAmt: string
    arbitrationPct: string
    withdrawalFee:  string
    netPayout:      string
  }) => sendEmail("escrow_released", to, data),

  disputeOpened: (to: string, data: {
    recipientName: string
    role:          "buyer" | "seller"
    itemTitle:     string
    orderId:       string
    reason:        string
  }) => sendEmail("dispute_opened", to, data),

  welcome: (to: string, data: {
    name: string
    role: "buyer" | "seller"
  }) => sendEmail("welcome", to, data),

}
