"use client"
import type { Listing } from "@/src/types"

import {AdminService, where, query} from "@/src/services"
// components/listings/ListingDetailClient.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SellerTrustScore } from "@/components/shared/SellerTrustScore"
import { SellerReviews } from "@/components/reviews/SellerReviews"
import {
  MapPin, Shield, Truck, Heart, Share2, MessageSquare,
  Tag, Clock, ChevronLeft, ChevronRight, Loader2,
  CheckCircle, Star, Store, ArrowLeft } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import {increment} from "@/src/services"

const conditionLabel: Record<string, string> = {
  brand_new: "Brand New", open_box: "Open Box",
  grade_a: "Grade A",    grade_b: "Grade B" }

interface Props {
  id: string
  initialListing: Listing   // pre-fetched by server for instant render
}

export function ListingDetailClient({ id, initialListing }: Props) {
  const { user }   = useAuth()
  const router     = useRouter()
  const { toast }  = useToast()

  const [listing,     setListing]     = useState<any>(initialListing)
  const [seller,      setSeller]      = useState<any>(null)
  const [loading,     setLoading]     = useState(!initialListing)
  const [imgIdx,      setImgIdx]      = useState(0)
  const [saved,       setSaved]       = useState(false)
  const [savingItem,  setSavingItem]  = useState(false)
  const [offerAmount, setOfferAmount] = useState("")
  const [offerOpen,   setOfferOpen]   = useState(false)
  const [offerLoading,setOfferLoading]= useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        // If we already have initialListing from server, skip the Firestore fetch
        // but still increment views and load seller/saved status
        const data = initialListing || await (async () => {
          const snap = await AdminService.getDoc("listings", id)
          if (!snap.exists()) return null
          return { id: snap.id, ...snap.data() }
        })()

        if (!data) { setLoading(false); return }
        setListing(data)

        // Increment views (client-side only)
        await AdminService.updateDoc("listings", id, { views: increment(1) })

        // Load seller
        if (data.sellerId) {
          const sellerSnap = await AdminService.getDoc("users", data.sellerId)
          if (sellerSnap.exists()) setSeller({ id: sellerSnap.id, ...sellerSnap.data() })
        }

        // Check if saved
        if (user?.uid) {
          const savedSnap = await AdminService.getDoc("users", user.uid, "savedListings", id)
          setSaved(savedSnap.exists())
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [id, user?.uid])

  const handleSave = async () => {
    if (!user?.uid) { router.push("/login"); return }
    setSavingItem(true)
    try {
      const ref = doc( "users", user.uid, "savedListings", id)
      if (saved) {
        const { deleteDoc } = await import("firebase/firestore")
        await AdminService.deleteDoc("stockAlerts", `${user.uid}_${listingId}`)
        setSaved(false)
        toast({ title: "Removed from saved" })
      } else {
        await AdminService.setDoc("stockAlerts", `${user.uid}_${listingId}`, { savedAt: serverTimestamp(), listingId: id })
        setSaved(true)
        toast({ title: "Saved!", variant: "success" })
      }
    } catch { toast({ title: "Error", variant: "destructive" }) }
    setSavingItem(false)
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: listing?.title, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast({ title: "Link copied!", variant: "success" })
    }
  }

  const handleChat = async () => {
    if (!user?.uid) { router.push("/login"); return }
    if (user.uid === listing?.sellerId) return
    try {
      const existing = await AdminService.getCollection("chats", [
        where("participants", "array-contains", user.uid),
        where("listingId", "==", id)
      ])
      const found = existing.docs.find(d => {
        const p = d.participants || []
        return p.includes(listing.sellerId)
      })
      if (found) { router.push(`/chat/${found.id}`); return }
      const chat = await AdminService.addDoc("chats", {
        participants:  [user.uid, listing.sellerId],
        listingId:     id,
        listingTitle:  listing.title,
        listingImage:  listing.images?.[0] || null,
        createdAt:     new Date(),
        lastMessage:   null })
      router.push(`/chat/${chat.id}`)
    } catch { toast({ title: "Could not open chat", variant: "destructive" }) }
  }

  const handleOffer = async () => {
    if (!user?.uid) { router.push("/login"); return }
    const amount = parseInt(offerAmount.replace(/\D/g, ""))
    if (!amount || amount < 1) { toast({ title: "Enter a valid amount", variant: "destructive" }); return }
    setOfferLoading(true)
    try {
      await AdminService.addDoc("offers", {
        listingId:    id,
        listingTitle: listing.title,
        listingImage: listing.images?.[0] || null,
        originalPrice: listing.priceSale,
        offerAmount:  amount,
        buyerId:      user.uid,
        buyerName:    user.fullName || user.email,
        sellerId:     listing.sellerId,
        status:       "pending",
        createdAt:    serverTimestamp() })
      setOfferOpen(false)
      setOfferAmount("")
      toast({ title: "Offer sent!", description: "The seller will respond shortly.", variant: "success" })
    } catch { toast({ title: "Error sending offer", variant: "destructive" }) }
    setOfferLoading(false)
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (!listing) return (
    <div className="container py-16 text-center space-y-4">
      <p className="text-xl font-semibold">Listing not found</p>
      <Button asChild variant="outline">
        <Link href="/search"><ArrowLeft className="h-4 w-4 mr-2" />Browse Listings</Link>
      </Button>
    </div>
  )

  const images   = listing.images?.length ? listing.images : ["/placeholder.jpg"]
  const isSeller = user?.uid === listing.sellerId

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-4xl py-4 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-3">
            <div className="relative aspect-square bg-muted rounded-2xl overflow-hidden">
              <Image src={images[imgIdx]} alt={listing.title} fill className="object-cover" />
              {listing.isBoosted && (
                <Badge className="absolute top-3 left-3 bg-primary text-white">⚡ Boosted</Badge>
              )}
              {listing.isHubVerified && (
                <Badge className="absolute top-3 right-3 bg-emerald-600 text-white">
                  <CheckCircle className="h-3 w-3 mr-1" /> Hub Verified
                </Badge>
              )}
              {images.length > 1 && (
                <>
                  <button onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img: string, i: number) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${i === imgIdx ? "border-primary" : "border-transparent"}`}>
                    <Image src={img} alt="" fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-xl font-heading font-bold text-secondary leading-tight">{listing.title}</h1>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={handleSave} disabled={savingItem}
                    className={`p-2 rounded-full border transition-colors ${saved ? "bg-red-50 border-red-200 text-red-500" : "border-border text-muted-foreground hover:border-red-200 hover:text-red-400"}`}>
                    <Heart className={`h-4 w-4 ${saved ? "fill-red-500" : ""}`} />
                  </button>
                  <button onClick={handleShare}
                    className="p-2 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {listing.condition && (
                  <Badge variant="secondary">{conditionLabel[listing.condition] || listing.condition}</Badge>
                )}
                {(listing.listingType === "rent" || listing.listingType === "both") && (
                  <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />For Rent</Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {(listing.listingType === "sale" || listing.listingType === "both") && (
                <p className="text-3xl font-bold text-primary">{formatPrice(listing.priceSale)}</p>
              )}
              {listing.priceRentDaily && (
                <p className="text-sm text-muted-foreground">{formatPrice(listing.priceRentDaily)}/day rental</p>
              )}
              {listing.depositAmount && (
                <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-md inline-block">
                  ₦{(listing.depositAmount / 100).toLocaleString()} deposit required
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{listing.city}{listing.nigerianState ? `, ${listing.nigerianState}` : ""}</span>
              {listing.deliveryNationwide && (
                <span className="ml-2 flex items-center gap-1 text-emerald-600 text-xs font-medium">
                  <Truck className="h-3.5 w-3.5" /> Nationwide delivery
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-full">
                <Shield className="h-3.5 w-3.5" /> Escrow Protected
              </div>
              {listing.isHubVerified && (
                <div className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-full">
                  <CheckCircle className="h-3.5 w-3.5" /> Hub Verified
                </div>
              )}
            </div>

            {!isSeller ? (
              <div className="space-y-2 pt-1">
                <Button className="w-full bg-primary text-white hover:bg-primary/90 h-12" onClick={handleChat}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Chat with Seller
                </Button>
                {(listing.listingType === "sale" || listing.listingType === "both") && (
                  <Button variant="outline" className="w-full h-10" onClick={() => setOfferOpen(true)}>
                    <Tag className="h-4 w-4 mr-2" /> Make an Offer
                  </Button>
                )}
              </div>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href={`/dashboard/seller/listings/${id}/edit`}>Edit Listing</Link>
              </Button>
            )}

            {offerOpen && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">Your Offer</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm font-medium">₦</span>
                    <input
                      type="number"
                      value={offerAmount}
                      onChange={e => setOfferAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-primary text-white" onClick={handleOffer} disabled={offerLoading}>
                      {offerLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send Offer"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setOfferOpen(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card>
          <CardContent className="p-5 space-y-2">
            <h2 className="font-semibold">Description</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{listing.description}</p>
          </CardContent>
        </Card>

        {seller && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">About the Seller</h2>
                <Link href={`/seller/${seller.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" /> View Store
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-lg">
                    {(seller.fullName || "S")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{seller.fullName || seller.storeName}</p>
                  {seller.storeName && <p className="text-xs text-muted-foreground">{seller.storeName}</p>}
                  <div className="flex items-center gap-1 text-xs text-amber-500 mt-0.5">
                    <Star className="h-3 w-3 fill-amber-400" />
                    <span>{(seller.sellerRating || 0).toFixed(1)}</span>
                    <span className="text-muted-foreground">· {seller.totalSales || 0} sales</span>
                  </div>
                </div>
              </div>
              <SellerTrustScore
                ninVerified={seller.ninVerified}
                bvnVerified={seller.bvnVerified}
                sellerRating={seller.sellerRating || 0}
                totalSales={seller.totalSales || 0}
                totalRentals={seller.totalRentals || 0}
                size="sm"
              />
            </CardContent>
          </Card>
        )}

        {listing.sellerId && (
          <div>
            <h2 className="font-semibold mb-3">Seller Reviews</h2>
            <SellerReviews sellerId={listing.sellerId} />
          </div>
        )}
      </div>
    </div>
  )
}
