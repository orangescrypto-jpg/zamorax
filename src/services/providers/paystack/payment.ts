// src/services/providers/paystack/payment.ts
// ─────────────────────────────────────────────────────────────────
// Paystack payment provider.
// Switch to this by changing ONE LINE in src/services/payment.ts
// Requires: PAYSTACK_SECRET_KEY and NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env
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

// NOTE: All Paystack API calls go through your own API routes (/app/api/payment/*)
// so your secret key is never exposed to the browser.

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

export const PaystackPaymentService: IPaymentService = {

  provider: "paystack",

  async getBankDetails(): Promise<BankDetails | null> {
    // Paystack collects directly — no manual bank details needed
    return null
  },

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const { purpose, amount, email, userId, metadata, callbackUrl, paystackChannel } = input

    const prefix = purpose === "order"
      ? "ZMX-ORD"
      : purpose === "subscription"
      ? "ZMX-SUB"
      : "ZMX-BST"

    const reference_code = generateReference(prefix)

    const result = await callApi<{ redirectUrl: string }>("/initialize", {
      provider: "paystack",
      amount,
      email,
      reference: reference_code,
      metadata: { ...metadata, userId, purpose },
      callbackUrl: callbackUrl ?? `${process.env.NEXT_PUBLIC_APP_URL}/payment/verify?ref=${reference_code}`,
      // "card" -> card only. "bank" -> bank transfer/USSD/direct debit only.
      // Omitted -> let the initialize route fall back to all channels.
      channel: paystackChannel,
    })

    return {
      provider: "paystack",
      redirectUrl: result.redirectUrl,
      reference: reference_code,
      reference_code,
    }
  },

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const result = await callApi<VerifyPaymentResult>("/verify", {
      provider: "paystack",
      reference: input.reference,
    })
    return result
  },

  async initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    // Real bank transfer via Paystack — distinct from the manual /payout
    // route (which only credits the wallet and queues a manual bank
    // transfer for admin to send by hand).
    const result = await callApi<InitiatePayoutResult>("/transfer", {
      provider: "paystack",
      ...input,
    })
    return result
  },

  async createRecipient(input: CreateRecipientInput): Promise<CreateRecipientResult> {
    const result = await callApi<CreateRecipientResult>("/recipient", {
      provider: "paystack",
      ...input,
    })
    return result
  },

  async resolveAccount(input: ResolveAccountInput): Promise<ResolveAccountResult> {
    const result = await callApi<ResolveAccountResult>("/resolve", {
      provider: "paystack",
      ...input,
    })
    return result
  },

  async adminConfirmPayment(_input: AdminConfirmPaymentInput): Promise<void> {
    // Not used for Paystack — payment is confirmed via verifyPayment API
    return
  },
}
