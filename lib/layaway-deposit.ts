// lib/layaway-deposit.ts
// The seller always sets the minimum deposit on their own listing, either
// as a percentage of the price or as a flat naira amount -- never both at
// once, one type is picked per listing. The admin only sets the outer
// bounds a seller cannot exceed for whichever type they picked (see
// platformSettings layawayMinDepositPercent/layawayMaxDepositPercent and
// layawayMinDepositFlatKobo/layawayMaxDepositFlatKobo). This is separate
// from the layaway exit fee, which is the admin's own setting for what a
// buyer is charged on cancellation or expiry (see
// subSettings layawayExitFeeType/Percent/FlatKobo) and is never set by
// the seller.
export interface ListingLayawayConfig {
  layaway_min_deposit_type?: string | null
  layaway_min_deposit_percent?: number | null
  layaway_min_deposit_flat_kobo?: number | null
  layaway_max_days?: number | null
}

export interface PlatformLayawayBounds {
  layawayMinDepositPercent: number
  layawayMaxDepositPercent: number
  layawayMinDepositFlatKobo: number
  layawayMaxDepositFlatKobo: number
  layawayMaxDays: number
}

export interface ComputedDeposit {
  depositType: "percent" | "flat"
  depositPercent: number | null   // set when depositType is "percent"
  requiredDepositKobo: number
  maxDays: number
}

export function computeRequiredDeposit(
  listing: ListingLayawayConfig,
  totalAmountKobo: number,
  platform: PlatformLayawayBounds,
): ComputedDeposit {
  const maxDays = Math.min(listing.layaway_max_days || platform.layawayMaxDays, platform.layawayMaxDays)

  if (listing.layaway_min_deposit_type === "flat") {
    const flatKobo = Math.min(
      Math.max(listing.layaway_min_deposit_flat_kobo || platform.layawayMinDepositFlatKobo, platform.layawayMinDepositFlatKobo),
      platform.layawayMaxDepositFlatKobo,
    )
    // A flat deposit can never exceed the item's own total price.
    const requiredDepositKobo = Math.min(flatKobo, totalAmountKobo)
    return { depositType: "flat", depositPercent: null, requiredDepositKobo, maxDays }
  }

  const depositPercent = Math.min(
    Math.max(listing.layaway_min_deposit_percent || platform.layawayMinDepositPercent, platform.layawayMinDepositPercent),
    platform.layawayMaxDepositPercent,
  )
  const requiredDepositKobo = Math.ceil((totalAmountKobo * depositPercent) / 100)
  return { depositType: "percent", depositPercent, requiredDepositKobo, maxDays }
}
