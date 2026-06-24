export interface RentRule {
  allowsRent: boolean
  allowsUsed: boolean
  requiresVideo: boolean
  depositPercent?: number
  maxRentalDays?: number
}

export const CATEGORY_RENT_RULES: Record<string, RentRule> = {
  // ── Existing ─────────────────────────────────────────────────────
  "phones-tablets":          { allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 50, maxRentalDays: 30 },
  "computing":               { allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 40, maxRentalDays: 60 },
  "electronics":             { allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 30, maxRentalDays: 14 },
  "fashion":                 { allowsRent: true,  allowsUsed: true,  requiresVideo: false, depositPercent: 20, maxRentalDays: 7  },
  "home-office":             { allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 30, maxRentalDays: 30 },
  "health-beauty":           { allowsRent: false, allowsUsed: false, requiresVideo: false },
  "baby-products":           { allowsRent: false, allowsUsed: true,  requiresVideo: false },
  "sporting-goods":          { allowsRent: true,  allowsUsed: true,  requiresVideo: false, depositPercent: 25, maxRentalDays: 14 },
  "groceries":               { allowsRent: false, allowsUsed: false, requiresVideo: false },
  "other":                   { allowsRent: false, allowsUsed: true,  requiresVideo: false },

  // ── New ──────────────────────────────────────────────────────────
  "vehicles":                { allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 60, maxRentalDays: 30  },
  "furniture":               { allowsRent: true,  allowsUsed: true,  requiresVideo: false, depositPercent: 30, maxRentalDays: 90  },
  "building-construction":   { allowsRent: true,  allowsUsed: true,  requiresVideo: false, depositPercent: 40, maxRentalDays: 60  },
  "solar-energy":            { allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 35, maxRentalDays: 90  },
  "agricultural-farming":    { allowsRent: true,  allowsUsed: true,  requiresVideo: false, depositPercent: 30, maxRentalDays: 30  },
  "event-party":             { allowsRent: true,  allowsUsed: true,  requiresVideo: false, depositPercent: 25, maxRentalDays: 7   },
  "heavy-equipment-power":   { allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 50, maxRentalDays: 30  },
  "musical-instruments":     { allowsRent: true,  allowsUsed: true,  requiresVideo: false, depositPercent: 30, maxRentalDays: 14  },
  "industrial-manufacturing":{ allowsRent: true,  allowsUsed: true,  requiresVideo: true,  depositPercent: 50, maxRentalDays: 60  },
  "kids-toys":               { allowsRent: false, allowsUsed: true,  requiresVideo: false },
  "pet-supplies":            { allowsRent: false, allowsUsed: true,  requiresVideo: false },
  "automotive-parts":        { allowsRent: false, allowsUsed: true,  requiresVideo: false },
  "books-education":         { allowsRent: false, allowsUsed: true,  requiresVideo: false },
}

export function getRentRule(slug: string): RentRule {
  return CATEGORY_RENT_RULES[slug] || { allowsRent: false, allowsUsed: true, requiresVideo: false }
}
