"use client"

import { AdminService } from "@/src/services"
// app/(public)/wishlist/[shareId]/page.tsx

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { Heart, Loader2, ExternalLink, ShoppingBag } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { JoinCta } from "@/components/JoinCta"

export default function SharedWishlistPage({ params }: { params: { shareId: string } }) {
  const [wishlist, setWishlist] = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await AdminService.getDoc("sharedWishlists", params.shareId)
        if (!snap) { setNotFound(true); setLoading(false); return }

        const data = snap

        // Check expiry
        if (data.expiresAt?.toDate && data.expiresAt.toDate() < new Date()) {
          setNotFound(true); setLoading(false); return
        }

        setWishlist(data)

        // Load all referenced listings in parallel
        const listingDocs = await Promise.all(
          (data.listingIds || []).map(async (id: string) => {
            const lSnap = await AdminService.getDoc("listings", id)
            return lSnap ? { ...lSnap, id: (lSnap as any).id ?? id } : null
          })
        )
        setListings(listingDocs.filter(Boolean))
      } catch { setNotFound(true) }
      setLoading(false)
    }
    load()
  }, [params.shareId])

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (notFound) return (
    <div className="container py-20 text-center space-y-4">
      <Heart className="h-14 w-14 mx-auto text-muted-foreground/30" />
      <p className="text-xl font-semibold">Wishlist not found</p>
      <p className="text-muted-foreground text-sm">This link may have expired or been removed.</p>
      <Button asChild className="bg-primary text-white hover:bg-primary/90">
        <Link href="/search"><ShoppingBag className="h-4 w-4 mr-2" /> Browse Listings</Link>
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-4xl py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
            <h1 className="text-2xl font-heading font-bold">
              {wishlist.listName || "Wishlist"}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Shared by <span className="font-medium text-foreground">{wishlist.ownerName}</span>
            {" · "}{listings.length} item{listings.length !== 1 ? "s" : ""}
          </p>
        </div>

        {listings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              All items in this wishlist are no longer available.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(item => (
              <Card key={item.id} className="overflow-hidden flex flex-col group">
                <div className="relative aspect-video bg-muted">
                  {item.images?.[0] ? (
                    <Image
                      src={item.images[0]}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                      No image
                    </div>
                  )}
                  {item.status !== "active" && (
                    <Badge className="absolute top-2 left-2 bg-gray-800/70 text-white text-xs capitalize">
                      {item.status}
                    </Badge>
                  )}
                  {item.isHubVerified && (
                    <Badge className="absolute top-2 right-2 bg-emerald-600 text-white text-xs">✓ Verified</Badge>
                  )}
                </div>

                <CardContent className="p-3 flex-1 flex flex-col gap-2">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <p className="text-primary font-bold">{formatPrice(item.priceSale || 0)}</p>
                  {item.city && (
                    <p className="text-xs text-muted-foreground truncate">📍 {item.city}{item.nigerianState ? `, ${item.nigerianState}` : ""}</p>
                  )}

                  <Button
                    asChild
                    size="sm"
                    className="mt-auto h-8 text-xs bg-primary text-white hover:bg-primary/90"
                    disabled={item.status !== "active"}
                  >
                    <Link href={`/listings/${item.id}`}>
                      <ExternalLink className="h-3 w-3 mr-1" /> View Listing
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center pt-4">
          <JoinCta
            label="Join Zamorax to save your own wishlist"
            loggedInLabel="Go to My Wishlist"
            loggedInHref="/dashboard/buyer/saved"
            variant="outline"
          />
        </div>
      </div>
    </div>
  )
}
