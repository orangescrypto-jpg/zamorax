// src/types/payment.ts
// ─────────────────────────────────────────────────────────────────
// All shared payment types — zero provider imports.
// Every payment provider must satisfy these interfaces.
// ─────────────────────────────────────────────────────────────────

// ── Payment purposes ─────────────────────────────────────────────
export type PaymentPurpose =
  | "order"         // buyer paying for a listing (escrow)
  | "subscription"  // seller upgrading plan
  | "boost"         // seller boosting a listing

// ── Active provider (set in src/services/payment.ts) ─────────────
export type PaymentProvider = "manual" | "paystack" | "flutterwave"

// ── Bank details (stored in Firestore settings/bankDetails) ───────
export interface BankDetails {
  bankName: string
  accountNumber: string
  accountName: string
  bankCode?: string       // used by Paystack/Flutterwave for transfers
  updatedAt?: string      // ISO string
}

// ── Initialize payment (collection — buyer pays) ──────────────────
export interface InitializePaymentInput {
  purpose: PaymentPurpose
  amount: number          // kobo
  email: string
  userId: string
  metadata: {
    orderId?: string
    listingId?: string
    boostId?: string
    plan?: string
    [key: string]: unknown
  }
  callbackUrl?: string    // where provider redirects after payment
  // Paystack only — restricts which channel(s) the checkout page shows.
  // "card"   -> card only ("Pay with Card" option)
  // "bank"   -> bank transfer + USSD + direct bank debit ("Bank (Online)" option)
  // Omitted -> all channels (used when Paystack is the only enabled method
  // and there's no separate card/bank split to offer).
  paystackChannel?: "card" | "bank"
}

export interface InitializePaymentResult {
  provider: PaymentProvider
  // For redirect providers (Paystack, Flutterwave):
  redirectUrl?: string
  reference?: string
  // For manual provider:
  manual?: true
  bankDetails?: BankDetails
  reference_code: string  // always present — stored on order/boost/sub doc
}

// ── Verify payment ────────────────────────────────────────────────
export interface VerifyPaymentInput {
  reference: string
  provider: PaymentProvider
}

export interface VerifyPaymentResult {
  verified: boolean
  amount?: number         // kobo — what was actually paid
  metadata?: Record<string, unknown>
  // Manual: admin sets this to true manually
  manuallyConfirmed?: boolean
}

// ── Payout (platform → seller bank) ──────────────────────────────
export interface InitiatePayoutInput {
  sellerId: string
  amountKobo: number
  bankName: string
  accountNumber: string
  accountName: string
  bankCode?: string
  reference: string
}

export interface InitiatePayoutResult {
  success: boolean
  transferCode?: string
  reference: string
  // If provider can't transfer, credits wallet instead
  walletCredited?: boolean
  error?: string
}

// ── Create bank recipient (Paystack/Flutterwave only) ─────────────
export interface CreateRecipientInput {
  accountName: string
  accountNumber: string
  bankCode: string
}

export interface CreateRecipientResult {
  recipientCode: string
}

// ── Resolve account (validate bank account) ───────────────────────
export interface ResolveAccountInput {
  accountNumber: string
  bankCode: string
}

export interface ResolveAccountResult {
  accountName: string
  accountNumber: string
}

// ── Admin confirm (manual provider only) ─────────────────────────
export interface AdminConfirmPaymentInput {
  reference: string
  adminId: string
  purpose: PaymentPurpose
  // The document to update after confirming
  orderId?: string
  boostId?: string
  subscriptionId?: string
}
