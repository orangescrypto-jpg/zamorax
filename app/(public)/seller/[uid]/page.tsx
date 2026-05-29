"use client"

import {AdminService, where, query} from "@/src/services"

import { useEffect, useState } from "react"
import { formatPrice } from "@/lib/utils"
import { SellerTrustScore } from "@/components/shared/SellerTrustScore"
import { SellerReviews } from "@/components/reviews/SellerReviews"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, MapPin, Star, Store, Package, MessageSquare, ArrowLeft, CheckCircle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SellerProfilePage({ params }: { params: { uid: string } }) {
  const router = useRouter()
  const [seller, setSeller] = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const sellerSnap = await AdminService.getDoc("users", params.uid)
        if (!sellerSnap) { setLoading(false); return }
        setSeller({ ...sellerSnap, id: (sellerSnap as any).id })

        const listingsSnap = await AdminService.getCollection("listings", [where("sellerId", "==", params.uid),
          where("status", "==", "active")
        ])
        setListings(listingsSnap.map(d => ({ ...d })))
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [params.uid])

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (!seller) return (
    <div className="container py-16 text-center space-y-4">
      <p className="text-xl font-semibold">Seller not found</p>
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-3xl py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Seller Header */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-2xl">
                {(seller.fullName || "S")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-heading font-bold">{seller.storeName || seller.fullName}</h1>
                  {seller.ninVerified && (
                    <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  )}
                </div>
                {seller.storeName && (
                  <p className="text-sm text-muted-foreground">{seller.fullName}</p>
                )}
                {seller.nigerianState && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" /> {seller.nigerianState}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <span className="flex items-center gap-1 text-amber-500">
                    <Star className="h-4 w-4 fill-amber-400" />
                    <strong>{(seller.sellerRating || 0).toFixed(1)}</strong>
                  </span>
                  <span className="text-muted-foreground">{seller.totalSales || 0} sales</span>
                  <span className="text-muted-foreground">{listings.length} active listings</span>
                </div>
              </div>
            </div>

            {seller.storeDescription && (
              <p className="text-sm text-muted-foreground border-t pt-4">{seller.storeDescription}</p>
            )}

            <Button asChild className="w-full bg-primary text-white hover:bg-primary/90">
              <Link href={`/chat?sellerId=${seller.id}`}>
                <MessageSquare className="h-4 w-4 mr-2" /> Message Seller
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Trust Score */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3">Trust Score</h2>
            <SellerTrustScore
              ninVerified={seller.ninVerified}
              bvnVerified={seller.bvnVerified}
              sellerRating={seller.sellerRating || 0}
              totalSales={seller.totalSales || 0}
              totalRentals={seller.totalRentals || 0}
              size="md"
              showBreakdown
            />
          </CardContent>
        </Card>

        {/* Active Listings */}
        <div>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" /> Active Listings ({listings.length})
          </h2>
          {listings.length === 0 ? (
            <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">
              <Store className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No active listings right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {listings.map(l => (
                <Link key={l.id} href={`/listings/${l.id}`}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="relative aspect-square bg-muted">
                      {l.images?.[0] ? (
                        <Image src={l.images[0]} alt={l.title} fill className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-2.5">
                      <p className="text-xs font-medium truncate">{l.title}</p>
                      <p className="text-xs font-bold text-primary mt-0.5">{formatPrice(l.priceSale)}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div>
          <h2 className="font-semibold mb-3">Reviews</h2>
          <SellerReviews sellerId={params.uid} />
        </div>
      </div>
    </div>
  )
}
