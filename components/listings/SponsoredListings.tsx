"use client"
// components/listings/SponsoredListings.tsx
// "Sponsored Products" row on a listing's detail page — shows boosted
// (paid placement) listings, biased toward the same category as the
// listing being viewed, via /api/listings/featured?category=&excludeId=.
// Horizontally scrollable, like Jumia's sponsored row, rather than a
// wrapping grid — these are paid placements, not a discovery grid.
// Count and on/off are admin-controlled via /admin/sub-settings →
// Sponsored Products (subSettings.sponsoredListingsEnabled /
// subSettings.sponsoredListingsCount).

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { ListingCard } from "@/components/listings/ListingCard"
import type { Listing } from "@/src/types"

interface Props {
  category: string
  excludeId: string
  count: number
}

export function SponsoredListings({ category, excludeId, count }: Props) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    const params = new URLSearchParams({ excludeId, limit: String(count) })
    if (category) params.set("category", category)

    fetch(`/api/listings/featured?${params.toString()}`)
      .then(r => r.json())
      .then((data: { listings?: Listing[] }) => {
        if (active) setListings(data.listings ?? [])
      })
      .catch(() => { if (active) setListings([]) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [category, excludeId, count])

  if (loading) {
    return (
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-amber-500" /> Sponsored Products
        </h2>
        <div className="flex gap-3 overflow-x-hidden">
          {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
            <div key={i} className="w-40 shrink-0 rounded-xl bg-muted animate-pulse aspect-[3/4]" />
          ))}
        </div>
      </div>
    )
  }

  if (listings.length === 0) return null

  return (
    <div>
      <h2 className="font-semibold mb-3 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-amber-500" /> Sponsored Products
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
        {listings.map(l => (
          <div key={l.id} className="w-40 sm:w-44 shrink-0 snap-start">
            <ListingCard listing={l} />
          </div>
        ))}
      </div>
    </div>
  )
}
