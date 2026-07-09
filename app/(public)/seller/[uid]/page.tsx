"use client"

import { AdminService, serverTimestamp } from "@/src/services"
import { SellerFollowsService } from "@/src/services"
import { NotificationsService } from "@/src/services"

import { useEffect, useState, use } from "react"
import { formatPrice } from "@/lib/utils"
import { SellerTrustScore } from "@/components/shared/SellerTrustScore"
import { SellerReviews } from "@/components/reviews/SellerReviews"
import { PlanBadge } from "@/components/subscription/PlanBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useAuth } from "@/hooks/useAuth"
import { Loader2, MapPin, Star, Store, Package, MessageSquare, ArrowLeft, CheckCircle, UserPlus, UserMinus, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"

// Next.js 15+/16: params is a Promise — must be unwrapped with use(), or
// uid is undefined here, /api/seller/undefined 404s, and the page
// renders blank. See app/(seller)/dashboard/seller/listings/[id]/edit/page.tsx
// for the same fix applied earlier.
export default function SellerProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()
  const { settings } = usePlatformSettings()
  const { toast } = useToast()

  const [seller,         setSeller]         = useState<any>(null)
  const [listings,       setListings]       = useState<any[]>([])
  const [loading,        setLoading]        = useState(true)
  const [loadError,      setLoadError]      = useState<string | null>(null)
  const [following,      setFollowing]      = useState(false)
  const [followerCount,  setFollowerCount]  = useState(0)
  const [followLoading,  setFollowLoading]  = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const sellerRes = await fetch(`/api/seller/${uid}`)
        if (!sellerRes.ok) { setLoading(false); return }
        const sellerData = await sellerRes.json()
        if (!sellerData) { setLoading(false); return }
        setSeller(sellerData)

        const listingsRes = await fetch(`/api/listings?sellerId=${uid}`)
        const listingsJson = listingsRes.ok ? await listingsRes.json() : { items: [] }
        setListings((listingsJson.items ?? []).map((d: any) => ({ ...d })))

        // Load follow state + count
        if (settings.sellerFollowsEnabled) {
          const [count] = await Promise.all([
            SellerFollowsService.getFollowerCount(uid),
          ])
          setFollowerCount(count)

          if (user?.uid && user.uid !== uid) {
            const isF = await SellerFollowsService.isFollowing(user.uid, uid)
            setFollowing(isF)
          }
        }
      } catch (e: any) {
        // Distinguish "this seller genuinely doesn't exist" from "something
        // broke while loading" — the former shows "Seller not found", the
        // latter shows a real error so it's obvious a bug needs fixing
        // rather than looking like a bad link.
        console.error(e)
        setLoadError(e?.message ?? "Something went wrong loading this store.")
      }
      setLoading(false)
    }
    load()
  }, [uid, user?.uid, settings.sellerFollowsEnabled])

  const handleToggleFollow = async () => {
    if (!isAuthenticated() || !user?.uid) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return }
    if (user.uid === uid) return

    setFollowLoading(true)
    try {
      if (following) {
        await SellerFollowsService.unfollowSeller(user.uid, uid)
        setFollowing(false)
        setFollowerCount(c => Math.max(0, c - 1))
        toast({ title: "Unfollowed store" })
      } else {
        await SellerFollowsService.followSeller(user.uid, uid, user.fullName || user.email || undefined)
        setFollowing(true)
        setFollowerCount(c => c + 1)
        toast({ title: "Following store!", variant: "success" })

        // Notify the seller
        try {
          await AdminService.addDoc("notifications", {
            userId:    uid,
            type:      "system",
            title:     "New Follower",
            body:      `${user.fullName || "Someone"} is now following your store`,
            link:      "/dashboard/seller/store",
            isRead:    false,
            createdAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      }
    } catch (e: any) {
      console.error("[follow]", e)
      toast({ title: "Error", description: e?.message ?? "Could not update follow status.", variant: "destructive" })
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (loadError) return (
    <div className="container py-16 text-center space-y-4">
      <p className="text-xl font-semibold">Couldn't load this store</p>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">{loadError}</p>
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
      </Button>
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

  const isOwnStore = user?.uid === uid

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
                  <PlanBadge plan={seller.plan} />
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
                  {settings.sellerFollowsEnabled && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {followerCount} follower{followerCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {seller.storeDescription && (
              <p className="text-sm text-muted-foreground border-t pt-4">{seller.storeDescription}</p>
            )}

            <div className="flex gap-2">
              <Button asChild className="flex-1 bg-primary text-white hover:bg-primary/90">
                <Link href={`/chat?sellerId=${seller.id}`}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Message Seller
                </Link>
              </Button>

              {/* Follow button — only if enabled and not own store */}
              {settings.sellerFollowsEnabled && !isOwnStore && (
                <Button
                  variant={following ? "outline" : "secondary"}
                  className={`flex items-center gap-2 ${following ? "border-primary/30 text-primary" : ""}`}
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : following ? (
                    <><UserMinus className="h-4 w-4" /> Unfollow</>
                  ) : (
                    <><UserPlus className="h-4 w-4" /> Follow</>
                  )}
                </Button>
              )}
            </div>
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
          <SellerReviews sellerId={uid} />
        </div>
      </div>
    </div>
  )
}
