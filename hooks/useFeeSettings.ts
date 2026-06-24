// hooks/useFeeSettings.ts
// React hook for reading fee settings in client components.
// Reads from Firestore config/fees via the feeSettings service (which goes
// through AdminService — no direct Firebase imports anywhere).
//
// Usage:
//   const { fees, loading } = useFeeSettings()
//   const rate = fees.commissionSale          // 4 (whole number %)
//   const decimal = fees.commissionSale / 100  // 0.04 (for math)

"use client"

import { useEffect, useState } from "react"
import {
  getFeeSettings,
  DEFAULT_FEE_SETTINGS,
  type FeeSettings,
} from "@/src/services/feeSettings"

export type { FeeSettings }
export { DEFAULT_FEE_SETTINGS as FEE_DEFAULTS }

// Module-level cache — shared across all hook instances on the same page load
let _cache: FeeSettings | null = null
let _promise: Promise<FeeSettings> | null = null

function fetchOnce(): Promise<FeeSettings> {
  if (_cache)   return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = getFeeSettings().then(f => { _cache = f; return f })
  return _promise
}

export function invalidateFeeCache(): void {
  _cache   = null
  _promise = null
}

/**
 * useFeeSettings()
 * Returns live fee settings from config/fees.
 * Falls back to DEFAULT_FEE_SETTINGS while loading — no null checks needed.
 */
export function useFeeSettings(): { fees: FeeSettings; loading: boolean } {
  const [fees,    setFees]    = useState<FeeSettings>(_cache ?? DEFAULT_FEE_SETTINGS)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) { setFees(_cache); setLoading(false); return }
    fetchOnce().then(f => { setFees(f); setLoading(false) })
  }, [])

  return { fees, loading }
}
