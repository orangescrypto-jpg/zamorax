// hooks/usePlatformSettings.ts
// Client-side hook that sits ON TOP of the service layer.
// All Firestore access goes through AdminService (src/services/providers/firebase/admin.ts)
// via getPlatformSettings() in src/services/platformSettings.ts.
// This hook adds React state + a module-level cache so all components
// on the same page share one service call, not one per component.

"use client"

import { useEffect, useState } from "react"
import { getPlatformSettings, DEFAULT_SETTINGS } from "@/src/services/platformSettings"
import type { PlatformSettings } from "@/src/services/platformSettings"

export type { PlatformSettings }
export { DEFAULT_SETTINGS as PLATFORM_DEFAULTS }

// Module-level cache — shared across all hook instances on the same page load
let _cache: PlatformSettings | null = null
let _promise: Promise<PlatformSettings> | null = null

function fetchOnce(): Promise<PlatformSettings> {
  if (_cache) return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = getPlatformSettings().then(s => { _cache = s; return s })
  return _promise
}

export function invalidatePlatformCache() {
  _cache = null
  _promise = null
}

/**
 * usePlatformSettings()
 * Returns full platform settings from config/platform.
 * Falls back to DEFAULT_SETTINGS while loading — no flash, no null checks needed.
 */
export function usePlatformSettings(): { settings: PlatformSettings; loading: boolean } {
  const [settings, setSettings] = useState<PlatformSettings>(_cache ?? DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) { setSettings(_cache); setLoading(false); return }
    fetchOnce().then(s => { setSettings(s); setLoading(false) })
  }, [])

  return { settings, loading }
}
