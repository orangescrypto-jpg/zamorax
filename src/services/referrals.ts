// src/services/referrals.ts
// WAS FIREBASE → NOW CLOUDFLARE D1
export { ReferralsService } from "@/src/services/providers/cloudflare/referrals"
export interface IReferralsService {
  getReferralRewards(): Promise<{ buyer_signup: number; first_order: number }>
  getReferralLink(userId: string): string
  applyReferralCode(newUserId: string, referrerId: string): Promise<void>
  triggerFirstOrderBonus(buyerId: string): Promise<void>
  creditReferralAgent(agentId: string, amountKobo: number, reason: string, fromUserId: string): Promise<void>
}
