// src/services/feeSettings.ts
// Fee-specific settings split out from the main platformSettings.ts.
// All values stored in Firestore at config/fees.
// AdminService is the ONLY way to read/write Firestore — no direct Firebase imports.
//
// STORAGE FORMAT (Firestore):
//   commissionSale:     4      → 4%  (whole number, NOT decimal)
//   commissionRental:   6      → 6%
//   insuranceRate:      0.5    → 0.5%
//   withdrawalFee:      15000  → ₦150 (kobo)
//   buyerConvenienceFee:15000  → ₦150 (kobo)
//   buyerFeeEnabled:    true
//
// USAGE IN COMPONENTS:
//   import { useFeeSettings } from "@/hooks/useFeeSettings"
//   const { fees } = useFeeSettings()
//   const commissionDecimal = fees.commissionSale / 100   // → 0.04
//
// WHY SEPARATE?
//   platformSettings.ts was getting very large. Fees change independently
//   and are read by many components (FeeBreakdown, FeeCalculator, BuyNowModal,
//   checkout, seller dashboard). This file owns that single concern.

import { AdminService } from "@/src/services"

// ─── Fee settings type ────────────────────────────────────────────────────────

export interface FeeSettings {
  // ── Seller-side fees ──────────────────────────────────────────────────────
  // Stored as whole numbers: 4 = 4%. Divide by 100 for math.
  commissionSale:   number   // % of item price deducted from seller payout
  commissionRental: number   // % of rental value deducted from seller payout
  insuranceRate:    number   // % added to arbitration/dispute fund (from seller payout)

  // Fixed fee deducted when seller requests a withdrawal (kobo)
  withdrawalFee: number

  // ── Buyer-side fee ────────────────────────────────────────────────────────
  // Flat convenience fee added to buyer's checkout total (kobo).
  // Framed as "payment processing fee" — NOT a platform fee.
  // Admin can disable entirely or change amount at any time.
  buyerConvenienceFee: number   // kobo — e.g. 15000 = ₦150
  buyerFeeEnabled:     boolean  // master toggle — false = ₦0 charged to buyer
  buyerFeeLabel:       string   // text shown at checkout, e.g. "Processing fee"
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_FEE_SETTINGS: FeeSettings = {
  // Seller fees — stored as whole % numbers
  commissionSale:   4,      // 4% — competitive, sustainable, covers Paystack costs
  commissionRental: 6,      // 6% — higher risk + service for rentals
  insuranceRate:    0.5,    // 0.5% — feeds the dispute/arbitration pool (AdminService)
  withdrawalFee:    15000,  // ₦150 kobo — covers bank transfer cost + margin

  // Buyer fee — off by default, admin can enable later
  buyerConvenienceFee: 15000,          // ₦150 kobo
  buyerFeeEnabled:     false,           // off at launch
  buyerFeeLabel:       "Processing fee",
}

// ─── Firestore path ───────────────────────────────────────────────────────────

const COLLECTION = "config"
const DOC_ID     = "fees"

// ─── Module-level cache ───────────────────────────────────────────────────────

let _cached: FeeSettings | null = null

// ─── Service methods ──────────────────────────────────────────────────────────

/**
 * One-time fetch of fee settings.
 * Falls back to DEFAULT_FEE_SETTINGS if Firestore doc doesn't exist yet.
 */
export async function getFeeSettings(): Promise<FeeSettings> {
  if (_cached) return _cached
  try {
    const snap = await AdminService.getDoc(COLLECTION, DOC_ID)
    if (snap) {
      _cached = { ...DEFAULT_FEE_SETTINGS, ...(snap as Partial<FeeSettings>) }
      return _cached
    }
  } catch { /* fall through to defaults */ }
  return DEFAULT_FEE_SETTINGS
}

/**
 * Save fee settings to Firestore.
 * Called from admin/fees settings page only.
 */
export async function saveFeeSettings(fees: Partial<FeeSettings>): Promise<void> {
  await AdminService.setDoc(COLLECTION, DOC_ID, fees, { merge: true })
  // Bust module-level cache so next read picks up the new values
  _cached = null
}

/**
 * Real-time subscription — all components on the same page share one listener.
 * Returns unsubscribe function.
 */
export function subscribeToFeeSettings(
  callback: (fees: FeeSettings) => void
): () => void {
  return AdminService.subscribeToDoc(COLLECTION, DOC_ID, doc => {
    const fees = doc
      ? { ...DEFAULT_FEE_SETTINGS, ...(doc as Partial<FeeSettings>) }
      : DEFAULT_FEE_SETTINGS
    _cached = fees
    callback(fees)
  })
}

export function invalidateFeeCache(): void {
  _cached = null
}

// ─── Helper: convert whole-number % to decimal multiplier ─────────────────────
// e.g. commissionSale = 4 → 0.04
export function toDecimal(wholePercent: number): number {
  return wholePercent / 100
}

// ─── Helper: calculate full fee breakdown for a transaction ───────────────────

export interface FeeBreakdownResult {
  itemPriceKobo:     number
  commissionKobo:    number
  insuranceKobo:     number
  withdrawalFeeKobo: number
  totalDeductionsKobo: number
  sellerPayoutKobo:  number
  buyerConvenienceKobo: number   // added to buyer total — 0 if disabled
  buyerTotalKobo:    number      // what buyer actually pays
  commissionPct:     number      // e.g. 4 (display)
  insurancePct:      number      // e.g. 0.5 (display)
}

export function calculateFees(
  itemPriceKobo: number,
  transactionType: "sale" | "rental",
  fees: FeeSettings
): FeeBreakdownResult {
  const commissionPct  = transactionType === "rental" ? fees.commissionRental : fees.commissionSale
  const commissionKobo = Math.floor(itemPriceKobo * toDecimal(commissionPct))
  const insuranceKobo  = Math.floor(itemPriceKobo * toDecimal(fees.insuranceRate))
  const withdrawalFeeKobo = fees.withdrawalFee
  const totalDeductionsKobo = commissionKobo + insuranceKobo + withdrawalFeeKobo
  const sellerPayoutKobo    = itemPriceKobo - totalDeductionsKobo
  const buyerConvenienceKobo = fees.buyerFeeEnabled ? fees.buyerConvenienceFee : 0
  const buyerTotalKobo       = itemPriceKobo + buyerConvenienceKobo

  return {
    itemPriceKobo,
    commissionKobo,
    insuranceKobo,
    withdrawalFeeKobo,
    totalDeductionsKobo,
    sellerPayoutKobo,
    buyerConvenienceKobo,
    buyerTotalKobo,
    commissionPct,
    insurancePct: fees.insuranceRate,
  }
}
