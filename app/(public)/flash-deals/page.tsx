"use client"

import {AdminService, query, orderBy, onSnapshot, where} from "@/src/services"

import { useEffect, useState } from "react"
import {ListingsService} from "@/src/services"
import { ListingCard } from "@/components/listings/ListingCard"
import { Zap, Loader2 } from "lucide-react"
export default function FlashDealsPage() {
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = AdminService._ref_("listings", [where("isActive", "==", true),
      where("flashDeal", "!=", null),
      orderBy("flashDeal")
    ])
    return onSnapshot(q, docs => {
      const active = docs
        .docs.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(isFlashDealActive)
      setDeals(active)
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  return (
    <main className="container py-6 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold">Flash Deals</h1>
          <p className="text-sm text-muted-foreground">Limited-time discounts. Grab them before they expire.</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {!loading && deals.length === 0 && (
        <div className="text-center py-24 space-y-3">
          <Zap className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-muted-foreground">No flash deals right now. Check back soon!</p>
        </div>
      )}

      {/* FIXED: getFlashPrice requires 2 args — (originalKobo, discountPercent)
          Was: ListingsService.getFlashPrice(listing)  ← 1 arg, TypeScript error
          Now: ListingsService.getFlashPrice(listing.priceSale, listing.flashDeal.discountPercent) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {deals.map(listing => (
          <ListingCard
            key={listing.id}
            listing={{
              ...listing,
              priceSale: ListingsService.getFlashPrice(listing.priceSale, listing.flashDeal.discountPercent) }}
          />
        ))}
      </div>
    </main>
  )
}
