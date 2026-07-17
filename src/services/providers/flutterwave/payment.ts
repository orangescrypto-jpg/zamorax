// src/services/providers/flutterwave/payment.ts
// ─────────────────────────────────────────────────────────────────
// Flutterwave payment provider — LIVE.
// Switch to this by turning on `flutterwavePaymentEnabled` in
// Admin → Settings → Payment Provider. Multiple providers can be on
// at once; the buyer picks one at checkout via usePaymentMethods().
//
// WHY THIS EXISTS / HOW IT DIFFERS FROM PAYSTACK:
// Paystack's subaccounts settle automatically on a schedule the moment a
// charge succeeds — there's no way to hold funds until delivery is
// confirmed, which is what got Zamorax's payment flow rejected by
// Paystack (see admin/payments notes). Flutterwave has a purpose-built
// escrow mechanism: passing `meta: [{ metaname: "rave_escrow_tx",
// metavalue: 1 }]` on a transaction holds the funds — they are NOT
// settled to anyone, including the platform — until we explicitly call
// POST /transactions/escrow/settle. That call is what actually pays the
// seller (or the seller's subaccount, if one is attached) and settles
// the platform's commission. This file wires initializePayment to always
// escrow-flag order payments, and wires initiatePayout (via
// adminConfirmPayment's caller, the buyer-confirms-delivery flow) to call
// the settle endpoint instead of a generic transfer.
//
// All calls go through your own API routes (/app/api/payment/*) so the
// FLW_SECRET_KEY is never exposed to the browser — same pattern as the
// Paystack provider file.
// ─────────────────────────────────────────────────────────────────

import type { IPaymentService } from "@/src/services/payment"
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  InitiatePayoutInput,
  InitiatePayoutResult,
  CreateRecipientInput,
  CreateRecipientResult,
  ResolveAccountInput,
  ResolveAccountResult,
  AdminConfirmPaymentInput,
  BankDetails,
} from "@/src/types/payment"

const BASE = "/api/payment"

async function callApi<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Payment API error")
  return data as T
}

function generateReference(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export const FlutterwavePaymentService: IPaymentService = {

  provider: "flutterwave",

  async getBankDetails(): Promise<BankDetails | null> {
    // Flutterwave collects directly — no manual bank details needed
    return null
  },

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const { purpose, amount, email, userId, metadata, callbackUrl, flutterwaveSubaccountId } = input

    const prefix = purpose === "order"
      ? "ZMX-ORD"
      : purpose === "subscription"
      ? "ZMX-SUB"
      : "ZMX-BST"

    const reference_code = generateReference(prefix)

    const result = await callApi<{ redirectUrl: string }>("/initialize", {
      provider: "flutterwave",
      amount,
      email,
      reference: reference_code,
      metadata: { ...metadata, userId, purpose },
      callbackUrl: callbackUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/payment/verify?ref=${reference_code}`,
      // Only order payments (buyer → seller escrow) get the escrow flag and
      // an optional subaccount split. Subscription/boost payments are
      // platform revenue with nothing to hold — they settle normally.
      escrow: purpose === "order",
      subaccountId: purpose === "order" ? flutterwaveSubaccountId : undefined,
    })

    return {
      provider: "flutterwave",
      redirectUrl: result.redirectUrl,
      reference: reference_code,
      reference_code,
    }
  },

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const result = await callApi<VerifyPaymentResult>("/verify", {
      provider: "flutterwave",
      reference: input.reference,
    })
    return result
  },

  async initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    // For order escrow releases this calls Flutterwave's escrow/settle
    // endpoint (funds already sitting in escrow get released to the
    // seller). For a standalone withdrawal payout (seller cashing out a
    // wallet balance that isn't tied to a specific held escrow tx) it
    // falls back to a normal Flutterwave transfer. The API route decides
    // which based on whether an escrowTxRef is present.
    const result = await callApi<InitiatePayoutResult>("/transfer", {
      provider: "flutterwave",
      ...input,
    })
    return result
  },

  async createRecipient(input: CreateRecipientInput): Promise<CreateRecipientResult> {
    const result = await callApi<CreateRecipientResult>("/recipient", {
      provider: "flutterwave",
      ...input,
    })
    return result
  },

  async resolveAccount(input: ResolveAccountInput): Promise<ResolveAccountResult> {
    const result = await callApi<ResolveAccountResult>("/resolve", {
      provider: "flutterwave",
      ...input,
    })
    return result
  },

  async adminConfirmPayment(_input: AdminConfirmPaymentInput): Promise<void> {
    // Not used for Flutterwave — payment is confirmed via verifyPayment API,
    // same as Paystack.
    return
  },
}
