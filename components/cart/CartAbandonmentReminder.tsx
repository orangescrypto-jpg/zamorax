"use client"
// components/cart/CartAbandonmentReminder.tsx
// Carts are Zustand + localStorage only ("zamorax-cart-v2") — there is no
// server-visible cart to scan, so this can't be a real cron job. Instead:
// on app load, check if the cart has items older than the configured
// threshold and the user hasn't dismissed today's reminder, then show a
// dismissible banner nudging checkout. Clicking it opens the cart drawer
// via a custom event, matching Navbar's existing local-state architecture
// rather than introducing a new global store.

import { useEffect, useState } from "react"
import { useCartItemsStore } from "@/store/cartStore"
import { useSubSettings } from "@/hooks/useSubSettings"
import { X, ShoppingCart, Clock } from "lucide-react"

const DISMISS_KEY = "zamorax-cart-reminder-dismissed-date"

export const OPEN_CART_EVENT = "zamorax:open-cart"

export function CartAbandonmentReminder() {
  const { settings, loading: settingsLoading } = useSubSettings()
  const cartItems = useCartItemsStore((s) => s.cartItems)
  const [visible, setVisible] = useState(false)
  const [staleCount, setStaleCount] = useState(0)

  useEffect(() => {
    if (settingsLoading || !settings.cartAbandonmentEnabled) { setVisible(false); return }
    if (cartItems.length === 0) { setVisible(false); return }

    const todayKey = new Date().toDateString()
    const dismissedDate = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null
    if (dismissedDate === todayKey) { setVisible(false); return }

    const thresholdMs = settings.cartAbandonmentThresholdHours * 60 * 60 * 1000
    const now = Date.now()
    const stale = cartItems.filter((item) => {
      const addedAt = new Date(item.addedAt).getTime()
      return !Number.isNaN(addedAt) && now - addedAt >= thresholdMs
    })

    setStaleCount(stale.length)
    setVisible(stale.length > 0)
  }, [cartItems, settings, settingsLoading])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toDateString())
    setVisible(false)
  }

  const openCart = () => {
    window.dispatchEvent(new CustomEvent(OPEN_CART_EVENT))
    dismiss()
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm">
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-card shadow-lg p-3.5">
        <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
          <ShoppingCart className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            You've got {staleCount} item{staleCount === 1 ? "" : "s"} waiting in your cart
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3 shrink-0" /> Prices and stock aren't held forever — check out before it's gone.
          </p>
          <button
            onClick={openCart}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            View Cart →
          </button>
        </div>
        <button
          onClick={dismiss}
          className="p-1 rounded-md hover:bg-muted transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
