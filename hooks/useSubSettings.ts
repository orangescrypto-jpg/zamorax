// hooks/useSubSettings.ts
// React hook for the separate "sub settings" config doc — see
// src/services/subSettings.ts for what belongs here and why.

"use client"

import { useEffect, useState } from "react"
import {
  getSubSettings,
  DEFAULT_SUB_SETTINGS,
  type SubSettings,
} from "@/src/services/subSettings"

export type { SubSettings }
export { DEFAULT_SUB_SETTINGS as SUB_SETTINGS_DEFAULTS }

// Module-level cache — shared across all hook instances on the same page load
let _cache: SubSettings | null = null
let _promise: Promise<SubSettings> | null = null
const _subscribers = new Set<(s: SubSettings) => void>()

function fetchOnce(): Promise<SubSettings> {
  if (_cache) return Promise.resolve(_cache)
  if (_promise) return _promise
  _promise = getSubSettings().then(s => { _cache = s; return s })
  return _promise
}

export function invalidateSubSettingsCache() {
  _cache = null
  _promise = null
  getSubSettings().then(s => {
    _cache = s
    _subscribers.forEach(fn => fn(s))
  }).catch(() => {})
}

/**
 * useSubSettings()
 * Returns live sub-settings. Falls back to defaults while loading.
 */
export function useSubSettings(): { settings: SubSettings; loading: boolean } {
  const [settings, setSettings] = useState<SubSettings>(_cache ?? DEFAULT_SUB_SETTINGS)
  const [loading, setLoading]   = useState(!_cache)

  useEffect(() => {
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
