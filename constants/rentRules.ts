export interface RentRule {
  allowsRent: boolean
  allowsUsed: boolean
  requiresVideo: boolean
  depositPercent?: number
  maxRentalDays?: number
}

export const CATEGORY_RENT_RULES: Record<string, RentRule> = {
  "phones-tablets": { allowsRent: true, allowsUsed: true, requiresVideo: true, depositPercent: 50, maxRentalDays: 30 },
  "computing": { allowsRent: true, allowsUsed: true, requiresVideo: true, depositPercent: 40, maxRentalDays: 60 },
  "electronics": { allowsRent: true, allowsUsed: true, requiresVideo: true, depositPercent: 30, maxRentalDays: 14 },
  "fashion": { allowsRent: true, allowsUsed: true, requiresVideo: false, depositPercent: 20, maxRentalDays: 7 },
  "home-office": { allowsRent: true, allowsUsed: true, requiresVideo: true, depositPercent: 30, maxRentalDays: 30 },
  "health-beauty": { allowsRent: false, allowsUsed: false, requiresVideo: false },
  "baby-products": { allowsRent: false, allowsUsed: true, requiresVideo: false },
  "sporting-goods": { allowsRent: false, allowsUsed: true, requiresVideo: false },
  "groceries": { allowsRent: false, allowsUsed: false, requiresVideo: false },
  "other": { allowsRent: false, allowsUsed: true, requiresVideo: false } // 👈 NEW
}

export function getRentRule(slug: string): RentRule {
  return CATEGORY_RENT_RULES[slug] || { allowsRent: false, allowsUsed: true, requiresVideo: false }
}
