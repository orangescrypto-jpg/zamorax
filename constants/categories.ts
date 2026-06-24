export interface CategoryConfig {
  id: string
  name: string
  slug: string
  phase: 1
  isActive: boolean
  allowsRent: boolean
  allowsUsed: boolean
  requiresVideo: boolean
  trustTip: string
  showOnHomepage: boolean
}

export const ALL_CATEGORIES: CategoryConfig[] = [
  // ── Homepage 16 (showOnHomepage: true) ──────────────────────────
  { id: "phones-tablets",        name: "Phones & Tablets",          slug: "phones-tablets",        phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: true,  showOnHomepage: true,  trustTip: "Always verify IMEI. All phones checked against national blacklist." },
  { id: "computing",             name: "Computing",                 slug: "computing",             phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: true,  showOnHomepage: true,  trustTip: "Request boot video for used laptops. Check serial number matches sticker." },
  { id: "electronics",          name: "Electronics",               slug: "electronics",           phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: true,  showOnHomepage: true,  trustTip: "Watch working video before buying. Check warranty with brand." },
  { id: "fashion",              name: "Fashion",                   slug: "fashion",               phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: false, showOnHomepage: true,  trustTip: "Real photos only. Check size chart. Rentals include hygiene seal." },
  { id: "vehicles",             name: "Vehicles",                  slug: "vehicles",              phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: true,  showOnHomepage: true,  trustTip: "Always inspect physically before payment. Verify papers and chassis number." },
  { id: "furniture",            name: "Furniture",                 slug: "furniture",             phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: false, showOnHomepage: true,  trustTip: "Check dimensions before buying. Rentals require a refundable deposit." },
  { id: "home-office",          name: "Home & Office",             slug: "home-office",           phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: true,  showOnHomepage: true,  trustTip: "Watch working video. Generators: watch cold-start. Large appliances pickup only." },
  { id: "health-beauty",        name: "Health & Beauty",           slug: "health-beauty",         phase: 1, isActive: true, allowsRent: false, allowsUsed: false, requiresVideo: false, showOnHomepage: true,  trustTip: "Only sealed products allowed. Always check expiry date." },
  { id: "building-construction",name: "Building & Construction",   slug: "building-construction", phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: false, showOnHomepage: true,  trustTip: "Confirm quality standards and certifications before purchase." },
  { id: "solar-energy",         name: "Solar & Renewable Energy",  slug: "solar-energy",          phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: true,  showOnHomepage: true,  trustTip: "Request working video for used panels and inverters. Check wattage specs." },
  { id: "agricultural-farming", name: "Agricultural & Farming",    slug: "agricultural-farming",  phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: false, showOnHomepage: true,  trustTip: "Confirm condition of equipment. Seeds and chemicals must be sealed." },
  { id: "event-party",          name: "Event & Party Supply",      slug: "event-party",           phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: false, showOnHomepage: true,  trustTip: "Confirm availability for your date. Rentals require deposit and return condition check." },
  { id: "heavy-equipment-power",name: "Heavy Equipment & Power",   slug: "heavy-equipment-power", phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: true,  showOnHomepage: true,  trustTip: "Watch cold-start video for generators. Verify KVA rating and fuel type." },
  { id: "kids-toys",            name: "Kids & Toys",               slug: "kids-toys",             phase: 1, isActive: true, allowsRent: false, allowsUsed: true,  requiresVideo: false, showOnHomepage: true,  trustTip: "Check age rating and safety markings. No broken parts or sharp edges." },
  { id: "groceries",            name: "Groceries & Supermarket",   slug: "groceries",             phase: 1, isActive: true, allowsRent: false, allowsUsed: false, requiresVideo: false, showOnHomepage: true,  trustTip: "All groceries from verified partner stores only. Check expiry." },
  { id: "automotive-parts",     name: "Automotive Parts",          slug: "automotive-parts",      phase: 1, isActive: true, allowsRent: false, allowsUsed: true,  requiresVideo: false, showOnHomepage: true,  trustTip: "Confirm compatibility with your vehicle model. Check part numbers." },

  // ── More Categories (showOnHomepage: false) ──────────────────────
  { id: "musical-instruments",  name: "Musical Instruments",       slug: "musical-instruments",   phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: false, showOnHomepage: false, trustTip: "Request playing demo video. Rentals include case and accessories." },
  { id: "pet-supplies",         name: "Pet Supplies",              slug: "pet-supplies",          phase: 1, isActive: true, allowsRent: false, allowsUsed: true,  requiresVideo: false, showOnHomepage: false, trustTip: "Pet food must be sealed and unexpired. Cages must be clean and undamaged." },
  { id: "industrial-manufacturing", name: "Industrial & Manufacturing", slug: "industrial-manufacturing", phase: 1, isActive: true, allowsRent: true, allowsUsed: true, requiresVideo: true, showOnHomepage: false, trustTip: "Request working video. Confirm machine specs and capacity before purchase." },
  { id: "books-education",      name: "Books & Education",         slug: "books-education",       phase: 1, isActive: true, allowsRent: false, allowsUsed: true,  requiresVideo: false, showOnHomepage: false, trustTip: "State edition and condition clearly. No torn or missing pages." },
  { id: "baby-products",        name: "Baby Products",             slug: "baby-products",         phase: 1, isActive: true, allowsRent: false, allowsUsed: true,  requiresVideo: false, showOnHomepage: false, trustTip: "Food must be sealed and unexpired. Used clothing must be washed." },
  { id: "sporting-goods",       name: "Sporting Goods",            slug: "sporting-goods",        phase: 1, isActive: true, allowsRent: true,  allowsUsed: true,  requiresVideo: false, showOnHomepage: false, trustTip: "Check size carefully. Used equipment must include working video." },
  { id: "other",                name: "Other",                     slug: "other",                 phase: 1, isActive: true, allowsRent: false, allowsUsed: true,  requiresVideo: false, showOnHomepage: false, trustTip: "Please provide clear details and photos. Buyer & seller agree on terms directly." },
]

export const HOMEPAGE_CATEGORIES = ALL_CATEGORIES.filter(c => c.showOnHomepage)
export const MORE_CATEGORIES     = ALL_CATEGORIES.filter(c => !c.showOnHomepage)

export function getCategoryBySlug(slug: string) {
  return ALL_CATEGORIES.find(c => c.slug === slug)
}
