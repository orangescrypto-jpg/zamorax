// src/services/wallet.ts
// ─────────────────────────────────────────────────────────────────
// Wallet service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { SellerWallet, WalletTransaction, PayoutRequest } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { WalletService } from "@/src/services/providers/firebase/wallet"
// ─────────────────────────────────────────────────────────────────

export interface IWalletService {
  getWallet(userId: string): Promise<SellerWallet | null>
  getTransactions(userId: string, limit?: number): Promise<WalletTransaction[]>

  requestPayout(data: {
    userId: string
    amount: number
    bankName: string
    accountNumber: string
    accountName: string
    paystackRecipientCode?: string
  }): Promise<{ id: string }>

  getPendingPayouts(): Promise<PayoutRequest[]>
  updatePayoutStatus(payoutId: string, status: string, extra?: Record<string, unknown>): Promise<void>

  // Agent wallets
  getAgentWallet(userId: string): Promise<{ balance: number; totalEarned: number }>
  getLogisticsAgentWallet(userId: string): Promise<{ balance: number; totalEarned: number }>
  creditLogisticsAgent(
    agentId: string,
    agentUserId: string,
    amountKobo: number,
    reason: "parcel_received" | "parcel_dispatched" | "parcel_delivered" | "doorstep_bonus",
    shipmentId: string,
  ): Promise<void>
}
