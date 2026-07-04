// src/services/payment.ts
// ─────────────────────────────────────────────────────────────────
// Payment service — public interface.
//
// HOW TO SWITCH PROVIDER:
// Comment the active line, uncomment the one you want.
// That's it. Zero changes anywhere else.
// ─────────────────────────────────────────────────────────────────

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

import { ManualPaymentService } from "@/src/services/providers/manual/payment"
import { PaystackPaymentService } from "@/src/services/providers/paystack/payment"
import { FlutterwavePaymentService } from "@/src/services/providers/flutterwave/payment"

export { ManualPaymentService, PaystackPaymentService, FlutterwavePaymentService }

// Default export — used by any code that doesn't yet do its own provider
// selection. Checkout flows (BuyNowModal, CartCheckoutModal) should prefer
// picking ManualPaymentService / PaystackPaymentService directly based on
// platform settings (manualPaymentEnabled / paystackPaymentEnabled) and,
// when both are enabled, the buyer's choice at checkout — rather than
// relying on this single default.
export { ManualPaymentService as PaymentService }

// ── Interface every provider must implement ───────────────────────
export interface IPaymentService {

  // Which provider this is
  readonly provider: "manual" | "paystack" | "flutterwave"

  /**
   * COLLECTION — Start a payment from a buyer.
   * - Manual: returns bank details + reference code
   * - Paystack/Flutterwave: returns redirect URL
   */
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>

  /**
   * VERIFY — Check if a payment was received.
   * - Manual: reads Firestore to see if admin confirmed
   * - Paystack/Flutterwave: hits provider API to verify
   */
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>

  /**
   * PAYOUT — Send money from platform to seller bank.
   * - Manual: credits seller wallet (admin sends manually)
   * - Paystack/Flutterwave: initiates bank transfer via API
   */
  initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult>

  /**
   * CREATE RECIPIENT — Register seller bank for future transfers.
   * - Manual: stores bank details in Firestore only
   * - Paystack/Flutterwave: creates recipient at provider
   */
  createRecipient(input: CreateRecipientInput): Promise<CreateRecipientResult>

  /**
   * RESOLVE ACCOUNT — Validate a bank account number.
   * - Manual: returns input as-is (no third-party validation)
   * - Paystack/Flutterwave: hits provider API
   */
  resolveAccount(input: ResolveAccountInput): Promise<ResolveAccountResult>

  /**
   * ADMIN CONFIRM — Mark a manual payment as confirmed.
   * Only used by manual provider. Others return immediately.
   */
  adminConfirmPayment(input: AdminConfirmPaymentInput): Promise<void>

  /**
   * GET BANK DETAILS — Fetch platform bank details from Firestore.
   * Used by manual provider to show buyer where to pay.
   */
  getBankDetails(): Promise<BankDetails | null>
}
