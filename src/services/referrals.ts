// src/services/referrals.ts
// WAS FIREBASE → NOW CLOUDFLARE D1
export { ReferralsService } from "@/src/services/providers/cloudflare/referrals"

export type ReferredRole = "buyer" | "seller"

export interface IReferralsService {
  getReferralRewards(): Promise<{
    buyer_signup: number
    first_order: number
    seller_signup: number
    seller_first_sale: number
  }>
  getReferralLink(userId: string): string
  applyReferralCode(newUserId: string, referrerId: string, referredRole: ReferredRole): Promise<void>
  triggerFirstOrderBonus(buyerId: string): Promise<void>
  triggerSellerFirstSaleBonus(sellerId: string): Promise<void>
  creditReferralAgent(agentId: string, amountKobo: number, reason: string, fromUserId: string): Promise<void>
}
