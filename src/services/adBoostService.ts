// src/services/adBoostService.ts
// Ad Boost service — public interface + provider switch.
// Components and pages import ONLY from this file.
// All Firestore access lives in the provider implementation below.
//
// STORAGE LAYOUT (for reference — never access directly outside provider):
//   adBoosts/                           — per-boost documents
//   adBoosts/{id}/reports/{weekId}      — weekly performance subcollection
//   config/platform                     — adBoostEnabled master toggle
//
// PLAN TYPES:
//   "standard"  — internal feed boost only
//   "ad"        — external Google + social only  (₦15,000/week)
//   "combined"  — internal + external            (₦18,000/week)

// ── Provider switch ────────────────────────────────────────────────────────────
export {
  AdBoostService,
  checkAdBoostEnabled,
  checkProductEligibility,
  getAdBoostPricing,
  createAdBoost,
  getActiveBoosts,
  getBoostReport,
  cancelAdBoost,
  adminUpdateBoostStatus,
  adminToggleAdBoost,
  adminGetAllBoosts,
  adminGetRevenueSummary,
  formatAdBoostPrice,
  FeatureDisabledError,
} from "@/src/services/providers/cloudflare/adBoost"

// ── Shared types (used across provider and consumers) ─────────────────────────

export type AdBoostPlanType = "standard" | "ad" | "combined"
export type AdBoostStatus   = "pending" | "active" | "running" | "completed" | "cancelled"
export type AdPlatform      = "google" | "instagram" | "facebook" | "tiktok" | "twitter"

export interface AdBoost {
  id:                string
  sellerId:          string
  productId:         string
  productTitle:      string
  planType:          AdBoostPlanType
  status:            AdBoostStatus
  startDate:         string | null
  endDate:           string | null
  weekNumber:        number
  platforms:         AdPlatform[]
  adCreativeUrl:     string
  paymentRef:        string
  amountPaid:        number
  adSpendBudget:     number
  marginAmount:      number
  impressions:       number
  clicks:            number
  reach:             number
  createdAt:         unknown
  updatedAt:         unknown
}

export interface AdBoostReport {
  id:           string
  adBoostId:    string
  weekNumber:   number
  impressions:  number
  clicks:       number
  reach:        number
  spend:        number
  reportedAt:   unknown
}

export interface AdBoostPlan {
  id:                     string
  name:                   string
  planType:               AdBoostPlanType
  price:                  number
  durationDays:           number
  platforms:              AdPlatform[]
  adSpendAllocation:      number
  maxProductsPerCampaign: number
  isActive:               boolean
}

export interface ServiceResult<T = void> {
  success: boolean
  data?:   T
  error?:  string
}

export interface EligibilityResult {
  eligible:             boolean
  hasImage:             boolean
  hasDescription:       boolean
  isVerifiedOrReviewed: boolean
  reasons:              string[]
}

export interface AdBoostPricing {
  adPrice:          number
  adAdSpend:        number
  adMargin:         number
  combinedPrice:    number
  combinedAdSpend:  number
  combinedMargin:   number
  durationDays:     number
  maxProducts:      number
}

export interface CreateAdBoostPayload {
  sellerId:      string
  productId:     string
  productTitle:  string
  planType:      AdBoostPlanType
  platforms:     AdPlatform[]
  adCreativeUrl: string
  paymentRef:    string
  amountPaid:    number
  adSpendBudget: number
  marginAmount:  number
}

export interface AdBoostRevenueSummary {
  totalCollected: number
  totalAdSpend:   number
  totalMargin:    number
  count:          number
}

/** IAdBoostService — contract that every provider must satisfy */
export interface IAdBoostService {
  checkEnabled(): Promise<void>
  checkProductEligibility(productId: string, sellerId: string): Promise<ServiceResult<EligibilityResult>>
  getPricing(): Promise<ServiceResult<AdBoostPricing>>
  create(payload: CreateAdBoostPayload): Promise<ServiceResult<{ adBoostId: string }>>
  getActiveBoosts(sellerId: string): Promise<ServiceResult<AdBoost[]>>
  getBoostReport(adBoostId: string): Promise<ServiceResult<AdBoostReport[]>>
  cancelBoost(adBoostId: string, sellerId: string): Promise<ServiceResult>
  adminUpdateStatus(
    adBoostId: string,
    status: Extract<AdBoostStatus, "running" | "completed" | "cancelled">,
  ): Promise<ServiceResult>
  adminToggle(enabled: boolean): Promise<ServiceResult>
  adminGetAll(status?: AdBoostStatus): Promise<ServiceResult<AdBoost[]>>
  adminGetRevenueSummary(weekNumber?: number): Promise<ServiceResult<AdBoostRevenueSummary>>
}
