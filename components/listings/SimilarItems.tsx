"use client"

import {AdminService, query, limit, orderBy, where} from "@/src/services"

import { useEffect, useState } from "react"
import { Listing } from "@/src/types"
import { ListingCard } from "@/components/listings/ListingCard"
import { Sparkles } from "lucide-react"

interface SimilarItemsProps {
  currentListingId: string
  categoryId: string
  priceSale: number
}

export function SimilarItems({ currentListingId, categoryId, priceSale }: SimilarItemsProps) {
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!categoryId || !priceSale) return

    const fetchSimilar = async () => {
      setLoading(true)
      try {
        // ±30% price range
        const minPrice = Math.floor(priceSale * 0.7)
        const maxPrice = Math.ceil(priceSale * 1.3)

        const q = await AdminService.getCollection("listings", [where("categoryId", "==", categoryId]),
          where("status", "==", "active"),
          where("isActive", "==", true),
          where("priceSale", ">=", minPrice),
          where("priceSale", "<=", maxPrice),
          orderBy("priceSale", "asc"),
          limit(10) // fetch extra, filter self out
        )

        const snap = await AdminService.getCollection(q)
        const results = docs
          .docs.map(d => ({ id: d.id, ...d.data() })
          .filter(l => l.id !== currentListingId)
          .slice(0, 6) // show max 6

        // If not enough in price range, try a broader category query
        if (results.length < 3) {
          const fallbackQ = await AdminService.getCollection("listings", [where("categoryId", "==", categoryId]),
            where("status", "==", "active"),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(10)
          )
          const fallbackSnap = await AdminService.getCollection(fallbackQ)
          const fallback = fallbackSnap.docs
            .docs.map(d => ({ id: d.id, ...d.data() })
            .filter(l => l.id !== currentListingId && !results.find(r => r.id === l.id))
            .slice(0, 6 - results.length)

          setItems([...results, ...fallback])
        } else {
          setItems(results)
        }
      } catch (e) {
        console.error("Similar items fetch error:", e)
      }
      setLoading(false)
    }

    fetchSimilar()
  }, [currentListingId, categoryId, priceSale])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-secondary">You might also like</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b pb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-secondary">You might also like</h2>
        <span className="text-xs text-muted-foreground ml-1">Similar items in this category</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(listing => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  )
}
