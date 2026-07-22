"use client"

// components/home/ZamoraxDirectSection.tsx
// Homepage section for official Zamorax Enterprises listings — bulk-sourced,
// locally warehoused stock, admin-managed. Same shape as FeaturedListings.tsx
// so it behaves consistently, but backed by /api/listings/official (which
// joins on users.is_official — see migration 0002) instead of the boosted-
// listings query. Count shown is admin-configurable
// (settings.homepageZamoraxDirectCount); the rest live on /zamorax-direct.

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, ArrowRight, Zap } from "lucide-react"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { ListingCard } from "@/components/listings/ListingCard"
import type { Listing } from "@/src/types"

export function ZamoraxDirectSection({ onLoaded }: { onLoaded?: (ids: string[]) => void } = {}) {
  const { settings } = usePlatformSettings()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const count = settings.homepageZamoraxDirectCount || 8

  useEffect(() => {
    if (!settings.homepageZamoraxDirectEnabled) { setLoading(false); return }

    fetch(`/api/listings/official?limit=${count}`)
      .then(r => r.json())
      .then((data: { listings?: Listing[] }) => {
        const items = data.listings ?? []
        setListings(items)
        onLoaded?.(items.map(l => l.id))
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [settings.homepageZamoraxDirectEnabled, count])

  if (!settings.homepageZamoraxDirectEnabled) return null
  if (loading || listings.length === 0) return null

  return (
    <section>
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="p-1.5 bg-emerald-50 rounded-lg shrink-0">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <h2 className="text-base font-bold text-foreground truncate">
                Zamorax Enterprises Direct
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 shrink-0">
                <Zap className="h-2.5 w-2.5" /> Fast Delivery
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Sold and shipped by Zamorax Enterprises, in stock, ready fast</p>
          </div>
        </div>
        <Link href="/zamorax-direct" className="text-xs text-primary font-medium flex items-center gap-0.5 shrink-0 whitespace-nowrap">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {/* Horizontal swipe carousel — same ListingCard, same shop/category
          context as everywhere else, just presented as slide cards the
          user swipes left/right through instead of a grid. */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {listings.map(l => (
          <div key={l.id} className="shrink-0 w-[46%] sm:w-[220px] snap-start">
            <ListingCard listing={l} />
          </div>
        ))}
      </div>
    </section>
  )
}
