"use client"
// components/listings/RelatedListings.tsx
// "You may also like" row on a listing's detail page — pulls other active
// listings from the same category (excluding the current listing), using
// ListingCard for consistent rendering. Count and on/off are admin-controlled
// via /admin/sub-settings → Related Listings
// (subSettings.relatedListingsEnabled / subSettings.relatedListingsCount).

import { useEffect, useState } from "react"
import { ListingsService } from "@/src/services"
import { ListingCard } from "@/components/listings/ListingCard"
import type { Listing } from "@/src/types"

interface Props {
  category: string
  excludeId: string
  count: number
}

export function RelatedListings({ category, excludeId, count }: Props) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    ListingsService.getListings({ category }, undefined)
      .then(res => {
        if (!active) return
        const filtered = res.items.filter(l => l.id !== excludeId).slice(0, count)
        setListings(filtered)
      })
      .catch(() => { if (active) setListings([]) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [category, excludeId, count])

  if (loading) {
    return (
      <div>
        <h2 className="font-semibold mb-3">You May Also Like</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="rounded-xl bg-muted animate-pulse aspect-[3/4]" />
          ))}
        </div>
      </div>
    )
  }

  if (listings.length === 0) return null

  return (
    <div>
      <h2 className="font-semibold mb-3">You May Also Like</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {listings.map(l => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  )
}
