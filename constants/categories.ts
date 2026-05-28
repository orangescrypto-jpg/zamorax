export interface CategoryConfig {
  id: string
  name: string
  slug: string
  phase: 1 // All set to 1 for launch
  isActive: boolean // All set to true for launch
  allowsRent: boolean
  allowsUsed: boolean
  requiresVideo: boolean
  trustTip: string
}

export const ALL_CATEGORIES: CategoryConfig[] = [
  { id: "phones-tablets", name: "Phones & Tablets", slug: "phones-tablets", phase: 1, isActive: true, allowsRent: true, allowsUsed: true, requiresVideo: true, trustTip: "Always verify IMEI. All phones checked against national blacklist." },
  { id: "computing", name: "Computing", slug: "computing", phase: 1, isActive: true, allowsRent: true, allowsUsed: true, requiresVideo: true, trustTip: "Request boot video for used laptops. Check serial number matches sticker." },
  { id: "electronics", name: "Electronics", slug: "electronics", phase: 1, isActive: true, allowsRent: true, allowsUsed: true, requiresVideo: true, trustTip: "Watch working video before buying. Check warranty with brand." },
  { id: "fashion", name: "Fashion", slug: "fashion", phase: 1, isActive: true, allowsRent: true, allowsUsed: true, requiresVideo: false, trustTip: "Real photos only. Check size chart. Rentals include hygiene seal." },
  { id: "home-office", name: "Home & Office", slug: "home-office", phase: 1, isActive: true, allowsRent: true, allowsUsed: true, requiresVideo: true, trustTip: "Watch working video. Generators: watch cold-start. Large appliances pickup only." },
  { id: "health-beauty", name: "Health & Beauty", slug: "health-beauty", phase: 1, isActive: true, allowsRent: false, allowsUsed: false, requiresVideo: false, trustTip: "Only sealed products allowed. Always check expiry date." },
  { id: "baby-products", name: "Baby Products", slug: "baby-products", phase: 1, isActive: true, allowsRent: false, allowsUsed: true, requiresVideo: false, trustTip: "Food must be sealed and unexpired. Used clothing must be washed." },
  { id: "sporting-goods", name: "Sporting Goods", slug: "sporting-goods", phase: 1, isActive: true, allowsRent: false, allowsUsed: true, requiresVideo: false, trustTip: "Check size carefully. Used equipment must include working video." },
  { id: "groceries", name: "Groceries & Supermarket", slug: "groceries", phase: 1, isActive: true, allowsRent: false, allowsUsed: false, requiresVideo: false, trustTip: "All groceries from verified partner stores only. Check expiry." },
  { id: "other", name: "Other", slug: "other", phase: 1, isActive: true, allowsRent: false, allowsUsed: true, requiresVideo: false, trustTip: "Please provide clear details and photos. Buyer & seller agree on terms directly." }
]

export function getCategoryBySlug(slug: string) {
  return ALL_CATEGORIES.find(c => c.slug === slug)
}
