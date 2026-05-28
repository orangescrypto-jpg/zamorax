// src/services/platformSettings.ts
// Single source of truth for all platform fees/prices from Firestore config/platform
// Admin changes take effect instantly — no redeploy needed

import { AdminService } from "@/src/services"

export interface PlatformSettings {
  commissionSale: number        // % e.g. 5
  commissionRental: number      // % e.g. 7
  insuranceRate: number         // % e.g. 1
  withdrawalFee: number         // flat kobo
  planStarterPrice: number      // kobo
  planProPrice: number          // kobo
  boostStandard: number         // kobo/day
  boostPremium: number
  boostCategoryTop: number
  hubVerificationFee: number
  minPayoutAmount: number
  promoEnabled: boolean
  maxPromoDiscountPercent: number
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  commissionSale: 5,
  commissionRental: 7,
  insuranceRate: 1,
  withdrawalFee: 10000,
  planStarterPrice: 500000,
  planProPrice: 1500000,
  boostStandard: 50000,
  boostPremium: 150000,
  boostCategoryTop: 300000,
  hubVerificationFee: 200000,
  minPayoutAmount: 100000,
  promoEnabled: true,
  maxPromoDiscountPercent: 50,
}

let _cached: PlatformSettings | null = null

export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (_cached) return _cached
  try {
    const snap = await AdminService.getDoc("config", "platform")
    if (snap?.exists()) {
      _cached = { ...DEFAULT_SETTINGS, ...snap.data() } as PlatformSettings
      return _cached
    }
  } catch { /* use defaults */ }
  return DEFAULT_SETTINGS
}

export function subscribeToPlatformSettings(
  callback: (settings: PlatformSettings) => void
): () => void {
  return AdminService.subscribeToCollection(
    "config",
    snap => {
      const doc = snap.docs.find(d => d.id === "platform")
      if (doc) {
        _cached = { ...DEFAULT_SETTINGS, ...doc.data() } as PlatformSettings
        callback(_cached)
      } else {
        callback(DEFAULT_SETTINGS)
      }
    }
  )
}

export function invalidateSettingsCache() { _cached = null }
