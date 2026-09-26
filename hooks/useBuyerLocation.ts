"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { UsersService } from "@/src/services"
import { nigerianStates } from "@/constants/nigerianStates"

const STORAGE_KEY = "zamorax_buyer_state"

export interface BuyerLocation {
  state: string | null
  source: "profile" | "manual" | "ip" | null
  loading: boolean
  /** Buyer manually confirmed/changed their state — persists for the session and, if logged in, to their profile settings. */
  setState: (state: string) => void
}

// Resolves the buyer's state in priority order:
//   1. Logged-in profile (buyer settings.deliveryState)
//   2. Manual override the buyer already gave this session (localStorage)
//   3. IP-based guess from the CF-IPCity/CF-IPCountry style header the
//      server attaches to the page response (see middleware.ts)
// Falls back to null if none resolve, so callers can show a generic
// "select your state" prompt.
export function useBuyerLocation(): BuyerLocation {
  const { user } = useAuth()
  const [state, setStateValue] = useState<string | null>(null)
  const [source, setSource] = useState<BuyerLocation["source"]>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      setLoading(true)

      // 1. Logged-in profile
      if (user?.uid) {
        try {
          const settings = await UsersService.getSettings(user.uid, "buyer")
          const profileState = settings?.deliveryState
          if (profileState && nigerianStates.includes(profileState)) {
            if (!cancelled) {
              setStateValue(profileState)
              setSource("profile")
              setLoading(false)
            }
            return
          }
        } catch {
          // fall through to other sources
        }
      }

      // 2. Manual override saved earlier this session
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
      if (saved && nigerianStates.includes(saved)) {
        if (!cancelled) {
          setStateValue(saved)
          setSource("manual")
          setLoading(false)
        }
        return
      }

      // 3. IP-based guess, read from a meta tag the server sets from the
      // request's CF-IPCity/CF-Region header (see middleware.ts + app/layout.tsx)
      const metaState = typeof document !== "undefined"
        ? document.querySelector('meta[name="x-buyer-ip-state"]')?.getAttribute("content")
        : null
      if (metaState && nigerianStates.includes(metaState)) {
        if (!cancelled) {
          setStateValue(metaState)
          setSource("ip")
          setLoading(false)
        }
        return
      }

      if (!cancelled) {
        setStateValue(null)
        setSource(null)
        setLoading(false)
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [user?.uid])

  const setState = useCallback((newState: string) => {
    setStateValue(newState)
    setSource("manual")
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, newState)
    }
    // Persist to profile too, so a logged-in buyer's choice sticks across devices
    if (user?.uid) {
      UsersService.getSettings(user.uid, "buyer")
        .then(existing => UsersService.saveSettings(user.uid, "buyer", { ...(existing ?? {}), deliveryState: newState }))
        .catch(() => { /* best-effort — session storage already covers this device */ })
    }
  }, [user?.uid])

  return { state, source, loading, setState }
}
