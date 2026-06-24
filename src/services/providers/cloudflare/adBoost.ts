// src/services/providers/cloudflare/adBoost.ts
// WAS FIREBASE → NOW CLOUDFLARE D1 of IAdBoostService.
// Nothing outside this file imports firebase/firestore directly for ad boosts.

import { AdminService, serverTimestamp, where } from "@/src/services"
import { getPlatformSettings, invalidateSettingsCache } from "@/src/services/platformSettings"
import type {
  IAdBoostService,
  AdBoost,
  AdBoostReport,
  AdBoostPricing,
  AdBoostStatus,
  CreateAdBoostPayload,
  EligibilityResult,
  ServiceResult,
  AdBoostRevenueSummary,
} from "@/src/services/adBoostService"

// ─── Custom error ──────────────────────────────────────────────────────────────

export class FeatureDisabledError extends Error {
  constructor() {
    super("Ad Boost is currently unavailable. Please check back later.")
    this.name = "FeatureDisabledError"
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** ISO week number helper — returns YYYYWW integer e.g. 202524 */
function getWeekNumber(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7)
  return d.getUTCFullYear() * 100 + week
}

/** Next Monday ISO string — campaign weeks start Monday */
function nextMondayISO(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function formatAdBoostPrice(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

// ─── Feature gate (exported for convenience) ───────────────────────────────────

export async function checkAdBoostEnabled(): Promise<void> {
  const settings = await getPlatformSettings()
  if (!settings.adBoostEnabled) throw new FeatureDisabledError()
}

// ─── Named function exports (backwards-compat with existing imports) ───────────

export async function checkProductEligibility(
  productId: string,
  sellerId: string,
): Promise<ServiceResult<EligibilityResult>> {
  return AdBoostService.checkProductEligibility(productId, sellerId)
}

export async function getAdBoostPricing(): Promise<ServiceResult<AdBoostPricing>> {
  return AdBoostService.getPricing()
}

export async function createAdBoost(
  payload: CreateAdBoostPayload,
): Promise<ServiceResult<{ adBoostId: string }>> {
  return AdBoostService.create(payload)
}

export async function getActiveBoosts(
  sellerId: string,
): Promise<ServiceResult<AdBoost[]>> {
  return AdBoostService.getActiveBoosts(sellerId)
}

export async function getBoostReport(
  adBoostId: string,
): Promise<ServiceResult<AdBoostReport[]>> {
  return AdBoostService.getBoostReport(adBoostId)
}

export async function cancelAdBoost(
  adBoostId: string,
  sellerId: string,
): Promise<ServiceResult> {
  return AdBoostService.cancelBoost(adBoostId, sellerId)
}

export async function adminUpdateBoostStatus(
  adBoostId: string,
  status: Extract<AdBoostStatus, "running" | "completed" | "cancelled">,
): Promise<ServiceResult> {
  return AdBoostService.adminUpdateStatus(adBoostId, status)
}

export async function adminToggleAdBoost(enabled: boolean): Promise<ServiceResult> {
  return AdBoostService.adminToggle(enabled)
}

export async function adminGetAllBoosts(
  status?: AdBoostStatus,
): Promise<ServiceResult<AdBoost[]>> {
  return AdBoostService.adminGetAll(status)
}

export async function adminGetRevenueSummary(
  weekNumber?: number,
): Promise<ServiceResult<AdBoostRevenueSummary>> {
  return AdBoostService.adminGetRevenueSummary(weekNumber)
}

// ─── Core implementation ───────────────────────────────────────────────────────

export const AdBoostService: IAdBoostService = {

  async checkEnabled() {
    const settings = await getPlatformSettings()
    if (!settings.adBoostEnabled) throw new FeatureDisabledError()
  },

  async checkProductEligibility(productId, sellerId) {
    try {
      await this.checkEnabled()

      const product = await AdminService.getDoc("listings", productId)
      if (!product) return { success: false, error: "Product not found." }

      const images = (product.images as string[] | undefined) ?? []
      const description: string = (product.description as string | undefined) ?? ""
      const hasImage = images.length >= 1
      const hasDescription = description.trim().length >= 30

      const seller = await AdminService.getDoc("users", sellerId)
      const isVerified = !!(seller?.isVerified || seller?.ninVerified || seller?.bvnVerified)
      const reviewCount: number = (seller?.reviewCount as number | undefined) ?? 0
      const isVerifiedOrReviewed = isVerified || reviewCount >= 1

      const reasons: string[] = []
      if (!hasImage)             reasons.push("Add at least 1 product image")
      if (!hasDescription)       reasons.push("Description must be at least 30 characters")
      if (!isVerifiedOrReviewed) reasons.push("Complete seller verification or receive 1 review first")

      return {
        success: true,
        data: {
          eligible: hasImage && hasDescription && isVerifiedOrReviewed,
          hasImage,
          hasDescription,
          isVerifiedOrReviewed,
          reasons,
        },
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Eligibility check failed" }
    }
  },

  async getPricing() {
    try {
      const s = await getPlatformSettings()
      return {
        success: true,
        data: {
          adPrice:         s.adBoostPriceStandard,
          adAdSpend:       s.adBoostAdSpendStandard,
          adMargin:        s.adBoostMarginStandard,
          combinedPrice:   s.adBoostPriceCombined,
          combinedAdSpend: s.adBoostAdSpendCombined,
          combinedMargin:  s.adBoostMarginCombined,
          durationDays:    s.adBoostCampaignDurationDays,
          maxProducts:     s.adBoostMaxProductsPerCampaign,
        },
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to load pricing" }
    }
  },

  async create(payload) {
    try {
      await this.checkEnabled()

      const startDate  = nextMondayISO()
      const startMs    = new Date(startDate).getTime()
      const settings   = await getPlatformSettings()
      const durationMs = settings.adBoostCampaignDurationDays * 86400000
      const endDate    = new Date(startMs + durationMs).toISOString()
      const weekNumber = getWeekNumber(new Date(startDate))

      const docRef = await AdminService.addDoc("adBoosts", {
        ...payload,
        status:      "pending" as AdBoostStatus,
        startDate,
        endDate,
        weekNumber,
        impressions: 0,
        clicks:      0,
        reach:       0,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      })

      await AdminService.updateDoc("listings", payload.productId, {
        adBoostStatus:    "pending",
        currentAdBoostId: docRef.id,
      })

      return { success: true, data: { adBoostId: docRef.id } }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to create Ad Boost" }
    }
  },

  async getActiveBoosts(sellerId) {
    try {
      await this.checkEnabled()
      const docs = await AdminService.getCollection("adBoosts", [
        where("sellerId", "==", sellerId),
        where("status", "in", ["pending", "active", "running"]),
      ])
      return { success: true, data: docs as AdBoost[] }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to load boosts" }
    }
  },

  async getBoostReport(adBoostId) {
    try {
      await this.checkEnabled()
      const docs = await AdminService.getCollection(`adBoosts/${adBoostId}/reports`, [])
      return { success: true, data: docs as AdBoostReport[] }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to load report" }
    }
  },

  async cancelBoost(adBoostId, sellerId) {
    try {
      await this.checkEnabled()

      const boost = await AdminService.getDoc("adBoosts", adBoostId)
      if (!boost)                  return { success: false, error: "Boost not found." }
      if (boost.sellerId !== sellerId) return { success: false, error: "Unauthorised." }
      if (boost.status !== "pending") {
        return { success: false, error: "Only pending boosts can be cancelled." }
      }

      await AdminService.updateDoc("adBoosts", adBoostId, {
        status:    "cancelled" as AdBoostStatus,
        updatedAt: serverTimestamp(),
      })

      if (boost.amountPaid && (boost.amountPaid as number) > 0) {
        const currentWallet = await AdminService.getDoc("wallets", sellerId)
        const current: number = (currentWallet?.balance as number | undefined) ?? 0
        await AdminService.updateDoc("wallets", sellerId, {
          balance: current + (boost.amountPaid as number),
        })
        await AdminService.addDoc(`wallets/${sellerId}/transactions`, {
          type:      "ad_boost_refund",
          amount:    boost.amountPaid,
          adBoostId,
          createdAt: serverTimestamp(),
        })
      }

      await AdminService.updateDoc("listings", boost.productId as string, {
        adBoostStatus:    null,
        currentAdBoostId: null,
      })

      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to cancel boost" }
    }
  },

  async adminUpdateStatus(adBoostId, status) {
    try {
      await AdminService.updateDoc("adBoosts", adBoostId, {
        status,
        updatedAt: serverTimestamp(),
      })

      const boost = await AdminService.getDoc("adBoosts", adBoostId)
      if (boost?.productId) {
        const done = status === "completed" || status === "cancelled"
        await AdminService.updateDoc("listings", boost.productId as string, {
          adBoostStatus:    done ? null : status,
          currentAdBoostId: done ? null : adBoostId,
        })
      }

      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Status update failed" }
    }
  },

  async adminToggle(enabled) {
    try {
      await AdminService.setDoc(
        "config",
        "platform",
        { adBoostEnabled: enabled, updatedAt: serverTimestamp() },
        { merge: true },
      )
      invalidateSettingsCache()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Toggle failed" }
    }
  },

  async adminGetAll(status) {
    try {
      const constraints = status ? [where("status", "==", status)] : []
      const docs = await AdminService.getCollection("adBoosts", constraints)
      return { success: true, data: docs as AdBoost[] }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to load boosts" }
    }
  },

  async adminGetRevenueSummary(weekNumber) {
    try {
      const constraints = weekNumber ? [where("weekNumber", "==", weekNumber)] : []
      const docs = await AdminService.getCollection("adBoosts", constraints)

      const summary = (docs as AdBoost[]).reduce<AdBoostRevenueSummary>(
        (acc, b) => ({
          totalCollected: acc.totalCollected + (b.amountPaid    ?? 0),
          totalAdSpend:   acc.totalAdSpend   + (b.adSpendBudget ?? 0),
          totalMargin:    acc.totalMargin    + (b.marginAmount   ?? 0),
          count:          acc.count + 1,
        }),
        { totalCollected: 0, totalAdSpend: 0, totalMargin: 0, count: 0 },
      )

      return { success: true, data: summary }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Failed to load summary" }
    }
  },
}
