"use client"

import Link from "next/link"
import { Banknote, ArrowRight } from "lucide-react"
import { useSubSettings } from "@/hooks/useSubSettings"

export function SellForCashBanner() {
  const { settings } = useSubSettings()
  if (!settings.buybackEnabled) return null

  return (
    <Link
      href="/sell-for-cash"
      className="block rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-white px-5 py-5 sm:px-8 sm:py-6 hover:opacity-95 transition-opacity"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex h-12 w-12 rounded-full bg-white/15 items-center justify-center shrink-0">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading font-bold text-lg sm:text-xl">Got an old phone or laptop?</p>
            <p className="text-sm text-white/90">Sell it to Zamorax for instant cash. No haggling.</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-sm font-semibold shrink-0">
          Get an Estimate <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  )
}
