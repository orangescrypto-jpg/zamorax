// src/services/providers/cloudflare/referrals.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import { DEFAULT_SETTINGS } from "@/src/services/platformSettings"
import type { IReferralsService } from "@/src/services/referrals"

const DEFAULTS = { buyer_signup: 50000, first_order: 200000 }

export const ReferralsService: IReferralsService = {

  async getReferralRewards() {
    try {
      const snap = await AdminService.getDoc("config", "platform") as Record<string, unknown> | null
      return {
        buyer_signup: Number(snap?.referralSignupRewardKobo ?? DEFAULTS.buyer_signup),
        first_order:  Number(snap?.referralOrderRewardKobo  ?? DEFAULTS.first_order),
      }
    } catch {
      return DEFAULTS
    }
  },

  getReferralLink(userId) {
    const base = typeof window !== "undefined" ? window.location.origin : "https://zamorax.ng"
    return `${base}?ref=${userId}`
  },

  async applyReferralCode(newUserId, referrerId) {
    if (newUserId === referrerId) return
    const rewards = await this.getReferralRewards()
    await AdminService.setDoc("referrals", newUserId, {
      referrer_id:        referrerId,
      new_user_id:        newUserId,
      status:             "signed_up",
      signup_reward_paid: false,
      order_reward_paid:  false,
    })
    await this.creditReferralAgent(referrerId, rewards.buyer_signup, "signup", newUserId)
  },

  async triggerFirstOrderBonus(buyerId) {
    const row = await AdminService.getDoc("referrals", buyerId) as Record<string, unknown> | null
    if (!row) return
    if (row.order_reward_paid || row.orderRewardPaid) return

    const rewards = await this.getReferralRewards()
    await AdminService.updateDoc("referrals", buyerId, {
      order_reward_paid:    true,
      status:               "ordered",
      order_reward_paid_at: new Date().toISOString(),
    })
    await this.creditReferralAgent(
      String(row.referrer_id ?? row.referrerId),
      rewards.first_order,
      "first_order",
      buyerId,
    )
  },

  async creditReferralAgent(agentId, amountKobo, reason, fromUserId) {
    const existing = await AdminService.getDoc("agent_wallets", agentId) as Record<string, unknown> | null
    const currentBalance = existing ? Number(existing.balance ?? 0) : 0
    const currentEarned  = existing ? Number(existing.total_earned ?? existing.totalEarned ?? 0) : 0

    await AdminService.setDoc("agent_wallets", agentId, {
      balance:     currentBalance + amountKobo,
      total_earned: currentEarned  + amountKobo,
      owner_id:    agentId,
    }, { merge: true })

    await AdminService.addDoc(`agent_wallets/${agentId}/transactions`, {
      amount:      amountKobo,
      type:        "referral",
      reason,
      from_user_id: fromUserId,
    })
  },
}
