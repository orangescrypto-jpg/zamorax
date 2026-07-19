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

export function ZamoraxDirectSection() {
  const { settings } = usePlatformSettings()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const count = settings.homepageZamoraxDirectCount || 8

  useEffect(() => {
    if (!settings.homepageZamoraxDirectEnabled) { setLoading(false); return }

    fetch(`/api/listings/official?limit=${count}`)
      .then(r => r.json())
      .then((data: { listings?: Listing[] }) => setListings(data.listings ?? []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [settings.homepageZamoraxDirectEnabled, count])

  if (!settings.homepageZamoraxDirectEnabled) return null
  if (loading || listings.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 rounded-lg">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
              Zamorax Direct
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                <Zap className="h-2.5 w-2.5" /> Fast Delivery
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">Sold and shipped by Zamorax — in stock, ready fast</p>
          </div>
        </div>
        <Link href="/zamorax-direct" className="text-xs text-primary font-medium flex items-center gap-0.5 shrink-0">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {listings.map(l => <ListingCard key={l.id} listing={l} />)}
      </div>
    </section>
  )
}
