// src/services/referrals.ts
// ─────────────────────────────────────────────────────────────────
// Referrals service — public interface.
// ─────────────────────────────────────────────────────────────────

// ── Switch provider here ─────────────────────────────────────────
export { ReferralsService } from "@/src/services/providers/firebase/referrals"
// ─────────────────────────────────────────────────────────────────

export interface IReferralsService {
  /** Get live reward rates from platform config */
  getReferralRewards(): Promise<{ buyer_signup: number; first_order: number }>

  /** Generate referral link for a user */
  getReferralLink(userId: string): string

  /** Apply a referral code when a new user signs up */
  applyReferralCode(newUserId: string, referrerId: string): Promise<void>

  /** Trigger first-order bonus for a buyer */
  triggerFirstOrderBonus(buyerId: string): Promise<void>

  /** Credit a referral agent wallet */
  creditReferralAgent(
    agentId: string,
    amountKobo: number,
    reason: string,
    fromUserId: string,
  ): Promise<void>
}
