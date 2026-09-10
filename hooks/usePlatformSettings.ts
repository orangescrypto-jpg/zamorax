// hooks/usePlatformSettings.ts
// Client-side hook that sits ON TOP of the service layer.
// All Firestore access goes through AdminService (src/services/providers/firebase/admin.ts)
// via getPlatformSettings() in src/services/platformSettings.ts.
// This hook adds React state + a module-level cache so all components
// on the same page share one service call, not one per component.

"use client"

import { useEffect, useState } from "react"
import { getPlatformSettings, DEFAULT_SETTINGS, isPlatformSettingsCachePopulated } from "@/src/services/platformSettings"
import type { PlatformSettings } from "@/src/services/platformSettings"

export type { PlatformSettings }
export { DEFAULT_SETTINGS as PLATFORM_DEFAULTS }

// Module-level cache — shared across all hook instances on the same page load
let _cache: PlatformSettings | null = null
let _promise: Promise<PlatformSettings> | null = null

// Subscriber list — so invalidation re-renders ALL mounted hook instances
const _subscribers = new Set<(s: PlatformSettings) => void>()

function fetchOnce(): Promise<PlatformSettings> {
  if (_cache) return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = getPlatformSettings().then(s => {
    // getPlatformSettings() has its own internal cache (_cached in
    // platformSettings.ts) that it only populates on a genuinely
    // successful fetch or a confirmed "no doc yet" response — never on a
    // failed request. We can use that as a signal here: if it populated
    // its cache, this was a real result worth locking into THIS hook's
    // module cache too. If it's still empty, this call was served from
    // the failure fallback — don't lock it in, so the next mount or the
    // 30s poll (subscribeToPlatformSettings) gets a real shot at
    // recovering actual settings instead of being stuck on defaults.
    if (isPlatformSettingsCachePopulated()) {
      _cache = s
    } else {
      _promise = null
    }
    return s
  })
  return _promise
}

export function invalidatePlatformCache() {
  _cache = null
  _promise = null
  // Re-fetch and notify all mounted components immediately
  getPlatformSettings().then(s => {
    _cache = s
    _subscribers.forEach(fn => fn(s))
  }).catch(() => {})
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
    // Subscribe so invalidatePlatformCache() can push fresh data to this instance
    _subscribers.add(setSettings)

    if (_cache) {
      setSettings(_cache)
      setLoading(false)
    } else {
      fetchOnce().then(s => { setSettings(s); setLoading(false) })
    }

    return () => { _subscribers.delete(setSettings) }
  }, [])

  return { settings, loading }
}
