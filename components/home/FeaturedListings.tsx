"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { ListingCard } from "@/components/listings/ListingCard"
import type { Listing } from "@/src/types"

export function FeaturedListings({ onLoaded }: { onLoaded?: (ids: string[]) => void }) {
  const { settings } = usePlatformSettings()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!settings.homepageFeaturedListingsEnabled) { setLoading(false); return }

    // Fetch from public API — no auth needed, server-side D1 query
    fetch("/api/listings/featured")
      .then(r => r.json())
      .then((data: { listings?: Listing[] }) => {
        const items = data.listings ?? []
        setListings(items)
        onLoaded?.(items.map(l => l.id))
      })
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [settings.homepageFeaturedListingsEnabled]) // eslint-disable-line

  if (!settings.homepageFeaturedListingsEnabled) return null
  if (loading || listings.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 rounded-lg">
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <h2 className="text-base font-bold text-foreground">Featured Listings</h2>
        </div>
        <Link href="/search?sort=popular" className="text-xs text-primary font-medium flex items-center gap-0.5">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {listings.map(l => <ListingCard key={l.id} listing={l} />)}
      </div>
    </section>
  )
}
