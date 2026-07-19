// hooks/useLastAddress.ts
// Single "last used" delivery address, auto-overwritten on each successful
// order. Stored inside the buyer's existing settings KV blob (no schema
// change, no new table) under the "lastAddress" key. Self-service — reads
// and writes go through /api/buyer/settings, which is already scoped to
// the authenticated caller's own uid (see UsersService.getSettings /
// saveSettings). Consumed by both BuyNowModal and CartCheckoutModal so
// there is one source of truth instead of duplicating this per-modal.
import { useState, useEffect, useCallback } from "react"
import { UsersService } from "@/src/services"

export interface LastAddress {
  street: string
  city:   string
  state:  string
  lga:    string
}

export function useLastAddress(uid: string | undefined) {
  const [lastAddress, setLastAddress] = useState<LastAddress | null>(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    UsersService.getSettings(uid, "buyer")
      .then(settings => {
        if (cancelled) return
        const addr = (settings as any)?.lastAddress
        if (addr && addr.street && addr.state) setLastAddress(addr)
      })
      .catch(() => { /* non-fatal — buyer just re-types */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [uid])

  // Fire-and-forget: never blocks or fails checkout if this write fails,
  // since it's a convenience feature, not part of the order itself.
  const saveLastAddress = useCallback(async (addr: LastAddress) => {
    if (!uid) return
    try {
      const existing = await UsersService.getSettings(uid, "buyer")
      await UsersService.saveSettings(uid, "buyer", {
        ...(existing ?? {}),
        lastAddress: addr,
      })
    } catch {
      // non-fatal
    }
  }, [uid])

  return { lastAddress, loading, saveLastAddress }
}
