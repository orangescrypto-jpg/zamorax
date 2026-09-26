"use client"

import { useState, useEffect, useCallback } from "react"
import { UsersService } from "@/src/services"
import { useAuth } from "@/hooks/useAuth"

export interface SellerAddress {
  id: string
  state: string
  city: string
  label?: string
}

// Seller's reusable pool of pickup/ship-from addresses, stored in their
// profile settings (settings.sellerAddresses) alongside store preferences,
// payout config, etc. No dedicated table needed. Listings then pick which
// of these apply per listing (see Step5Location.tsx), stored as a JSON
// snapshot on the listing itself so it stays accurate even if the seller
// later edits or removes an address from their pool.
export function useSellerAddresses() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<SellerAddress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user?.uid) { setLoading(false); return }
      try {
        const settings = await UsersService.getSettings(user.uid, "seller")
        if (!cancelled) setAddresses(settings?.sellerAddresses ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.uid])

  const save = useCallback(async (next: SellerAddress[]) => {
    setAddresses(next)
    if (!user?.uid) return
    const existing = await UsersService.getSettings(user.uid, "seller")
    await UsersService.saveSettings(user.uid, "seller", { ...(existing ?? {}), sellerAddresses: next })
  }, [user?.uid])

  const addAddress = useCallback((addr: Omit<SellerAddress, "id">) => {
    const next = [...addresses, { ...addr, id: crypto.randomUUID() }]
    return save(next)
  }, [addresses, save])

  const removeAddress = useCallback((id: string) => {
    return save(addresses.filter(a => a.id !== id))
  }, [addresses, save])

  const updateAddress = useCallback((id: string, patch: Partial<Omit<SellerAddress, "id">>) => {
    return save(addresses.map(a => a.id === id ? { ...a, ...patch } : a))
  }, [addresses, save])

  return { addresses, loading, addAddress, removeAddress, updateAddress }
}
