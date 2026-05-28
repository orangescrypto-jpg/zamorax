"use client"

import {AdminService, query, orderBy, onSnapshot, where} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { formatPrice } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Tag, ArrowRight } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
const statusColors: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  countered:"bg-blue-100 text-blue-800",
  expired:  "bg-gray-100 text-gray-600" }

export default function BuyerOffersPage() {
  const { user } = useAuth()
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return

    // FIX: removed orderBy — it requires a Firestore composite index which
    // causes an infinite loading spinner when the index doesn't exist.
    // Sort client-side instead.
    const q = AdminService._ref_("offers", [where("buyerId", "==", user.uid)])

    const unsub = onSnapshot(
      q,
      docs => {
        const sorted = docs
          .map(d => ({ ...d } as { id: string; createdAt?: { toMillis?: () => number }; [key: string]: unknown }))
          .sort((a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
          )
        setOffers(sorted)
        setLoading(false)
      },
      err => {
        console.error("Offers error:", err)
        setLoading(false)
      }
    )

    // Safety timeout — stop spinner after 5s no matter what
    const timeout = setTimeout(() => setLoading(false), 5000)

    return () => { unsub(); clearTimeout(timeout) }
  }, [user?.uid])

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <main className="container max-w-lg py-6 pb-24 space-y-4">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Tag className="h-5 w-5" /> My Offers
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {offers.length} offer{offers.length !== 1 ? "s" : ""} made
        </p>
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
                  <img
                    src={o.listingImage}
                    className="w-12 h-12 rounded-lg object-cover border shrink-0"
                    alt=""
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{o.listingTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.createdAt?.toDate
                      ? formatDistanceToNow(o.createdAt.toDate(), { addSuffix: true })
                      : "Just now"}
                  </p>
                </div>
              </div>
              <Badge className={`shrink-0 capitalize ${statusColors[o.status] || "bg-gray-100"}`}>
                {o.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 rounded-lg p-3">
              <div>
                <p className="text-muted-foreground">Listed Price</p>
                <p className="font-semibold">{formatPrice(o.originalPrice)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Your Offer</p>
                <p className="font-semibold text-primary">{formatPrice(o.offerAmount)}</p>
              </div>
              {o.counterAmount && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Counter Offer from Seller</p>
                  <p className="font-semibold text-blue-600">{formatPrice(o.counterAmount)}</p>
                </div>
              )}
            </div>

            {o.status === "accepted" && (
              <Link
                href={`/listings/${o.listingId}`}
                className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium p-2.5 border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                Proceed to Purchase <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}

            {o.status === "countered" && o.counterAmount && (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-primary text-white text-xs h-8">
                  Accept ₦{(o.counterAmount / 100).toLocaleString()}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs h-8">
                  Decline
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </main>
  )
}
