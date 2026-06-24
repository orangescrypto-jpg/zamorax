// src/services/providers/flutterwave/payment.ts
// ─────────────────────────────────────────────────────────────────
// Flutterwave payment provider — STUB.
// Ready to implement when you scale.
// Switch to this by changing ONE LINE in src/services/payment.ts
// Requires: FLW_SECRET_KEY and NEXT_PUBLIC_FLW_PUBLIC_KEY in .env
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

// ── TODO when implementing ────────────────────────────────────────
// 1. npm install flutterwave-node-v3
// 2. Add FLW_SECRET_KEY + NEXT_PUBLIC_FLW_PUBLIC_KEY to .env
// 3. Replace each throw below with real Flutterwave API calls
// 4. Change ONE LINE in src/services/payment.ts to activate
// ─────────────────────────────────────────────────────────────────

export const FlutterwavePaymentService: IPaymentService = {

  provider: "flutterwave",

  async getBankDetails(): Promise<BankDetails | null> {
    // Flutterwave collects directly — no manual bank details needed
    return null
  },

  async initializePayment(_input: InitializePaymentInput): Promise<InitializePaymentResult> {
    // TODO: Call https://api.flutterwave.com/v3/payments
    throw new Error("FlutterwavePaymentService.initializePayment: not implemented yet")
  },

  async verifyPayment(_input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    // TODO: Call https://api.flutterwave.com/v3/transactions/{id}/verify
    throw new Error("FlutterwavePaymentService.verifyPayment: not implemented yet")
  },

  async initiatePayout(_input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    // TODO: Call https://api.flutterwave.com/v3/transfers
    throw new Error("FlutterwavePaymentService.initiatePayout: not implemented yet")
  },

  async createRecipient(_input: CreateRecipientInput): Promise<CreateRecipientResult> {
    // TODO: Call https://api.flutterwave.com/v3/beneficiaries
    throw new Error("FlutterwavePaymentService.createRecipient: not implemented yet")
  },

  async resolveAccount(_input: ResolveAccountInput): Promise<ResolveAccountResult> {
    // TODO: Call https://api.flutterwave.com/v3/accounts/resolve
    throw new Error("FlutterwavePaymentService.resolveAccount: not implemented yet")
  },

  async adminConfirmPayment(_input: AdminConfirmPaymentInput): Promise<void> {
    // Not used for Flutterwave
    return
  },
}
