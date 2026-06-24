"use client"
// components/home/TrustBar.tsx
// Shows admin-configurable platform stats (listings, sellers, buyers, transactions).
// Reads from usePlatformSettings — no direct Firebase access.

import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { Store, Users, ShoppingBag, Banknote } from "lucide-react"

// Fallback icons and labels if admin has the bar enabled but no values set
const STAT_META = [
  { key: "platformStatListings",     label: "Active Listings",    icon: <Store       className="h-4 w-4 text-primary shrink-0" /> },
  { key: "platformStatSellers",      label: "Verified Sellers",   icon: <Users       className="h-4 w-4 text-accent shrink-0" /> },
  { key: "platformStatBuyers",       label: "Happy Buyers",       icon: <ShoppingBag className="h-4 w-4 text-amber-500 shrink-0" /> },
  { key: "platformStatTransactions", label: "Safe Transactions",  icon: <Banknote    className="h-4 w-4 text-emerald-500 shrink-0" /> },
] as const

export function TrustBar() {
  const { settings } = usePlatformSettings()

  if (!settings.platformStatsEnabled) return null

  return (
    <div className="bg-white border-b border-border/60">
      <div className="container py-3 overflow-x-auto">
        <div className="flex items-center justify-between min-w-max md:min-w-0 gap-6 md:gap-0">
          {STAT_META.map(({ key, label, icon }) => {
            const value = settings[key as keyof typeof settings] as string | undefined
            if (!value) return null
            return (
              <div
                key={key}
                className="flex items-center gap-2 px-2 md:flex-1 md:justify-center"
              >
                {icon}
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-secondary whitespace-nowrap">
                    {value}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
