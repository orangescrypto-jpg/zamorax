// src/services/providers/cloudflare/wallet.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { IWalletService } from "@/src/services/wallet"
import type { SellerWallet, WalletTransaction, PayoutRequest } from "@/src/types"

export const WalletService: IWalletService = {

  async getWallet(userId) {
    const row = await AdminService.getDoc("seller_wallets", userId) as Record<string, unknown> | null
    if (!row) return null
    return {
      userId,
      balance:        Number(row.balance         ?? 0),
      pendingBalance: Number(row.pending_balance  ?? row.pendingBalance ?? 0),
      totalEarned:    Number(row.total_earned     ?? row.totalEarned    ?? 0),
      updatedAt:      String(row.updated_at       ?? new Date().toISOString()),
    } as SellerWallet
  },

  async getTransactions(userId, pageLimit = 20) {
    const all = (await AdminService.getCollection("wallet_transactions")) as Record<string, unknown>[]
    return all
      .filter(r => String(r.user_id ?? r.userId) === userId)
      .sort((a: any, b: any) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .slice(0, pageLimit)
      .map(r => ({
        ...r,
        id:           String(r.id),
        userId:       String(r.user_id ?? r.userId),
        type:         String(r.type),
        amount:       Number(r.amount),
        balanceAfter: Number(r.balance_after ?? r.balanceAfter ?? 0),
        description:  r.description ? String(r.description) : undefined,
        reference:    r.reference   ? String(r.reference)   : undefined,
        orderId:      r.order_id    ? String(r.order_id)    : undefined,
        status:       String(r.status ?? "completed"),
        createdAt:    String(r.created_at ?? new Date().toISOString()),
      } as WalletTransaction))
  },

  async requestPayout(data) {
    return AdminService.addDoc("payout_requests", {
      user_id:        data.userId,
      amount:         data.amount,
      bank_name:      data.bankName,
      account_number: data.accountNumber,
      account_name:   data.accountName,
      paystack_recipient_code: data.paystackRecipientCode ?? null,
      status:         "pending",
    })
  },

  async getPendingPayouts() {
    const all = (await AdminService.getCollection("payout_requests")) as Record<string, unknown>[]
    return all
      .filter(r => r.status === "pending")
      .sort((a: any, b: any) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .map(r => ({
        ...r,
        id:                    String(r.id),
        userId:                String(r.user_id ?? r.userId ?? r.seller_id ?? r.sellerId ?? ""),
        amount:                Number(r.amount),
        bankName:              String(r.bank_name     ?? r.bankName     ?? ""),
        accountNumber:         String(r.account_number ?? r.accountNumber ?? ""),
        accountName:           String(r.account_name  ?? r.accountName  ?? ""),
        paystackRecipientCode: r.paystack_recipient_code ? String(r.paystack_recipient_code) : undefined,
        paystackReference:     r.paystack_reference      ? String(r.paystack_reference)      : undefined,
        failureReason:         r.failure_reason          ? String(r.failure_reason)          : undefined,
        status:                String(r.status),
        createdAt:             String(r.created_at    ?? new Date().toISOString()),
        processedAt:           r.processed_at ? String(r.processed_at) : undefined,
      } as PayoutRequest))
  },

  async updatePayoutStatus(payoutId, status, extra = {}) {
    await AdminService.updateDoc("payout_requests", payoutId, {
      status,
      processed_at: new Date().toISOString(),
      ...extra,
    })
  },

  async getAgentWallet(userId) {
    const row = await AdminService.getDoc("agent_wallets", userId) as Record<string, unknown> | null
    return row
      ? { balance: Number(row.balance ?? 0), totalEarned: Number(row.total_earned ?? row.totalEarned ?? 0) }
      : { balance: 0, totalEarned: 0 }
  },

  async getLogisticsAgentWallet(userId) {
    const row = await AdminService.getDoc("logistics_agent_wallets", userId) as Record<string, unknown> | null
    return row
      ? { balance: Number(row.balance ?? 0), totalEarned: Number(row.total_earned ?? row.totalEarned ?? 0) }
      : { balance: 0, totalEarned: 0 }
  },

  async creditLogisticsAgent(agentId, agentUserId, amountKobo, reason, shipmentId) {
    const existing = await AdminService.getDoc("logistics_agent_wallets", agentUserId) as Record<string, unknown> | null
    const currentBalance = existing ? Number(existing.balance ?? 0) : 0
    const currentEarned  = existing ? Number(existing.total_earned ?? existing.totalEarned ?? 0) : 0

    await AdminService.setDoc("logistics_agent_wallets", agentUserId, {
      balance:      currentBalance + amountKobo,
      total_earned: currentEarned  + amountKobo,
      agent_id:     agentId,
      agent_user_id: agentUserId,
    }, { merge: true })

    await AdminService.addDoc(`logistics_agent_wallets/${agentUserId}/transactions`, {
      amount:      amountKobo,
      type:        "logistics",
      reason,
      shipment_id: shipmentId,
    })
  },
}
