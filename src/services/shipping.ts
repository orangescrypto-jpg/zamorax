// src/services/shipping.ts
// ─────────────────────────────────────────────────────────────────
// Shipping methods service.
//
// OPTION A — ZamoraxLogic is the single source of truth for agent coverage.
// Covered states are fetched live from ZamoraxLogic's /api/v1/coverage
// endpoint. The marketplace's own agentLocations collection is no longer
// used for coverage — admin only manages agents on ZamoraxLogic.
//
// FBZ covered states are still stored on config/platform (unchanged).
// ─────────────────────────────────────────────────────────────────

import { AdminService }        from "@/src/services"
import { ZamoraxLogicClient }  from "@/lib/zamoraxlogic"

export type ShippingMethodKey = "meetup" | "zamorax_logistics" | "fbz"

export interface ShippingMethodConfig {
  meetupEnabled:    boolean
  zlaEnabled:       boolean
  fbzEnabled:       boolean
  zlaCoveredStates: string[]  // live from ZamoraxLogic /api/v1/coverage
  fbzCoveredStates: string[]  // stored on config/platform
}

/** Per-state coverage detail returned to the checkout UI */
export interface ZLAStateCoverage {
  sellerCovered: boolean   // active agent exists in seller's state on ZamoraxLogic
  buyerCovered:  boolean   // active agent exists in buyer's state on ZamoraxLogic
  bothCovered:   boolean   // true only when both are covered → ZLA option enabled
}

const DEFAULTS: ShippingMethodConfig = {
  meetupEnabled:    true,
  zlaEnabled:       true,
  fbzEnabled:       true,
  zlaCoveredStates: [],
  fbzCoveredStates: [],
}

export const ShippingService = {

  /** Full config — used by seller listing form and buyer checkout */
  async getConfig(): Promise<ShippingMethodConfig> {
    try {
      const platform = await AdminService.getDoc("config", "platform")
      if (!platform) return DEFAULTS

      const meetupEnabled = (platform as any).safeMeetEnabled  ?? true
      const zlaEnabled    = (platform as any).logisticsEnabled ?? true
      const fbzEnabled    = (platform as any).fbzEnabled       ?? true

      const fbzCoveredStates: string[] = (platform as any).fbzCoveredStates ?? []
      const zlaCoveredStates = await ShippingService.getZLACoveredStates()

      return { meetupEnabled, zlaEnabled, fbzEnabled, zlaCoveredStates, fbzCoveredStates }
    } catch {
      return DEFAULTS
    }
  },

  /**
   * Fetch covered states live from ZamoraxLogic /api/v1/coverage.
   * ZamoraxLogic is the single source of truth — no local agentLocations
   * collection needed on the marketplace side.
   *
   * Falls back to [] if ZamoraxLogic is unreachable, so the ZLA option
   * gracefully becomes unavailable rather than crashing checkout.
   */
  async getZLACoveredStates(): Promise<string[]> {
    try {
      const res = await ZamoraxLogicClient.getCoverage()
      return res.coveredStates ?? []
    } catch {
      return []
    }
  },

  /**
   * Check ZLA coverage for a specific seller state + buyer state pair.
   * Single API call to ZamoraxLogic — returns granular flags for checkout UI.
   *
   * sellerCovered → origin agent available in seller's state
   * buyerCovered  → destination agent available in buyer's state
   * bothCovered   → ZLA delivery is fully operational for this route
   */
  async getCoverageForStates(
    sellerState: string,
    buyerState:  string,
  ): Promise<ZLAStateCoverage> {
    try {
      const res = await ZamoraxLogicClient.getCoverage()
      const covered = res.coveredStates ?? []

      const sellerCovered = sellerState ? covered.includes(sellerState) : false
      const buyerCovered  = buyerState  ? covered.includes(buyerState)  : false

      return {
        sellerCovered,
        buyerCovered,
        bothCovered: sellerCovered && buyerCovered,
      }
    } catch {
      return { sellerCovered: false, buyerCovered: false, bothCovered: false }
    }
  },

  /** Save FBZ covered states to config/platform (unchanged) */
  async saveFBZCoveredStates(states: string[]): Promise<void> {
    await AdminService.updateDoc("config", "platform", {
      fbzCoveredStates: states,
    })
  },
}
