"use client"

import { OffersService } from "@/src/services"
import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Tag, ArrowRight, Check, X, RefreshCw } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow, parseISO } from "date-fns"

const statusColors: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  countered:"bg-blue-100 text-blue-800",
  expired:  "bg-gray-100 text-gray-600",
}

function timeAgo(val: unknown): string {
  if (!val) return "Just now"
  try {
    const d = typeof val === "string" ? parseISO(val) : new Date(val as any)
    return formatDistanceToNow(d, { addSuffix: true })
  } catch { return "Just now" }
}

export default function BuyerOffersPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!user?.uid) return
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await OffersService.getOffersByBuyer(user.uid)
      setOffers(data.sort((a: any, b: any) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      ))
    } catch (e: any) {
      toast({ title: "Could not load offers", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.uid])

  useEffect(() => { load() }, [load])

  const handleAcceptCounter = async (offer: any) => {
    if (!offer.counterAmount) return
    setProcessing(offer.id)
    try {
      await OffersService.acceptCounterOffer(offer.id, offer.counterAmount)
      toast({
        title: "Counter Accepted! 🎉",
        description: `Deal locked at ${formatPrice(offer.counterAmount)}. Proceed to purchase.`,
        variant: "success",
      })
      load(true)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleDeclineCounter = async (offerId: string) => {
    setProcessing(offerId)
    try {
      await OffersService.respondToOffer(offerId, "declined")
      toast({ title: "Counter declined." })
      load(true)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <main className="container max-w-lg py-6 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Tag className="h-5 w-5" /> My Offers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {offers.length} offer{offers.length !== 1 ? "s" : ""} made
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5"
          disabled={refreshing}
          onClick={() => load(true)}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {offers.length === 0 && (
        <div className="border border-dashed rounded-xl py-16 text-center text-muted-foreground space-y-3">
          <Tag className="h-10 w-10 mx-auto opacity-20" />
          <p>No offers made yet.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/search">Browse Listings</Link>
          </Button>
        </div>
      )}

      {offers.map(o => (
        <Card key={o.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                {o.listingImage && (
                  <img src={o.listingImage} className="w-12 h-12 rounded-lg object-cover border shrink-0" alt="" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{o.listingTitle}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</p>
                </div>
              </div>
              <Badge className={`shrink-0 capitalize ${statusColors[o.status] || "bg-gray-100"}`}>
                {o.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-muted-foreground">Listed Price</p>
                <p className="font-semibold">
                  {o.originalPrice > 0 ? formatPrice(o.originalPrice) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Your Offer</p>
                <p className="font-semibold text-primary">{formatPrice(o.offerAmount)}</p>
              </div>
              {o.counterAmount && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Counter from Seller</p>
                  <p className="font-semibold text-blue-600">{formatPrice(o.counterAmount)}</p>
                </div>
              )}
            </div>

            {/* Accepted — link buyer to proceed with purchase */}
            {o.status === "accepted" && (
              <Link
                href={`/listings/${o.listingId}?buyNow=1`}
                className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-medium p-2.5 border border-emerald-300 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                ✓ Accepted — Buy Now at {formatPrice(o.offerAmount)} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}

            {/* Counter offer — buyer responds */}
            {o.status === "countered" && o.counterAmount && (
              <div className="space-y-2">
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                  Seller countered at <strong>{formatPrice(o.counterAmount)}</strong>. Accept to lock this price for purchase.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                    disabled={processing === o.id}
                    onClick={() => handleAcceptCounter(o)}
                  >
                    {processing === o.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><Check className="h-3 w-3 mr-1" /> Accept {formatPrice(o.counterAmount)}</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    disabled={processing === o.id}
                    onClick={() => handleDeclineCounter(o.id)}
                  >
                    <X className="h-3 w-3 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </main>
  )
}
