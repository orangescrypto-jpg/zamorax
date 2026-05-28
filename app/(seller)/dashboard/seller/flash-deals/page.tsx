"use client"

import {AdminService, onSnapshot, where, query} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { CreateFlashDealModal, FlashDealBadge } from "@/components/listings/FlashDeal"
import {ListingsService} from "@/src/services"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, Loader2, Package, TrendingUp } from "lucide-react"
import Image from "next/image"
import {DocumentData} from "@/src/services"

type Listing = DocumentData & { id: string }

export default function SellerFlashDealsPage() {
  const uid = useAuthStore(s => s.user?.uid)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)

  useEffect(() => {
    if (!uid) return
    // Only active listings can run flash deals
    const q = AdminService.getCollection("listings", [where("sellerId", "==", uid), where("status", "==", "active")])
    return onSnapshot(q, snap => {
      setListings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [uid])

  const activeDeals = listings.filter(l => ListingsService.isFlashDealActive(l))
  const eligible = listings.filter(l => !ListingsService.isFlashDealActive(l))

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-3xl space-y-8 pb-24">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-red-500" /> Flash Deals
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create time-limited discounts to boost visibility and sell faster.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        {[
          { icon: "⚡", title: "Set a discount", desc: "5% – 50% off" },
          { icon: "⏱️", title: "Choose duration", desc: "1hr to 48hrs" },
          { icon: "🔥", title: "Get more views", desc: "Featured in Flash Deals page" },
        ].map(item => (
          <div key={item.title} className="p-3 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-2xl mb-1">{item.icon}</p>
            <p className="font-semibold text-secondary">{item.title}</p>
            <p className="text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Active flash deals */}
      {activeDeals.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            Active Flash Deals ({activeDeals.length})
          </h2>
          {activeDeals.map(listing => (
            <Card key={listing.id} className="border-red-200 bg-red-50/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                    {listing.images?.[0]
                      ? <Image src={listing.images[0]} alt="" fill className="object-cover" />
                      : <Package className="h-6 w-6 m-3 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{listing.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs line-through text-muted-foreground">{formatPrice(listing.priceSale)}</span>
                      <span className="text-sm font-bold text-red-600">
                        {formatPrice(ListingsService.getFlashPrice(listing.priceSale, listing.flashDeal.discountPercent))}
                      </span>
                      <Badge className="bg-red-600 text-white text-xs">{listing.flashDeal.discountPercent}% OFF</Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => setSelectedListing(listing)}
                  >
                    Manage
                  </Button>
                </div>
                <FlashDealBadge listing={listing} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Eligible listings */}
      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Start a Flash Deal
        </h2>

        {eligible.length === 0 && activeDeals.length === 0 && (
          <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No active listings. Post a listing first to run a flash deal.</p>
          </div>
        )}

        {eligible.length === 0 && activeDeals.length > 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            All your active listings are already running flash deals.
          </p>
        )}

        {eligible.map(listing => (
          <Card key={listing.id} className="hover:border-red-300 transition-colors">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                {listing.images?.[0]
                  ? <Image src={listing.images[0]} alt="" fill className="object-cover" />
                  : <Package className="h-6 w-6 m-3 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{listing.title}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(listing.priceSale)} · {listing.views || 0} views</p>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => setSelectedListing(listing)}
              >
                <Zap className="h-3.5 w-3.5 mr-1" /> Start Deal
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedListing && (
        <CreateFlashDealModal
          listing={selectedListing}
          open={!!selectedListing}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </div>
  )
}
