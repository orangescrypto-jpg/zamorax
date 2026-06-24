"use client"
// app/(seller)/dashboard/seller/reviews/page.tsx
// Shows all reviews received by the seller with star breakdown

import { useEffect, useState } from "react"
import { AdminService, where, orderBy } from "@/src/services"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Star, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          className={cn("h-3.5 w-3.5", s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")}
        />
      ))}
    </div>
  )
}

export default function SellerReviewsPage() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const unsub = AdminService.subscribeToCollection(
      "reviews",
      docs => { setReviews(docs); setLoading(false) },
      [where("sellerId", "==", user.uid), orderBy("createdAt", "desc")]
    )
    return unsub
  }, [user?.uid])

  const avg = reviews.length
    ? Math.round((reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length) * 10) / 10
    : 0

  const breakdown = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100) : 0,
  }))

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-2xl py-8 space-y-6 pb-24 md:pb-8">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Star className="h-6 w-6 text-amber-400 fill-amber-300" /> My Reviews
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">What buyers say about you</p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-5 flex items-center gap-6">
          <div className="text-center shrink-0">
            <p className="text-5xl font-extrabold text-foreground">{avg || "—"}</p>
            <StarRow rating={Math.round(avg)} />
            <p className="text-xs text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {breakdown.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right text-muted-foreground">{star}</span>
                <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-5 text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Review list */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 space-y-3 border border-dashed rounded-2xl">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No reviews yet. Complete orders to receive reviews.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <Card key={review.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {(review.buyerName || "B")[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{review.buyerName || "Buyer"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {review.createdAt
                          ? formatDistanceToNow(
                              typeof review.createdAt === "string"
                                ? new Date(review.createdAt)
                                : review.createdAt.toDate(),
                              { addSuffix: true }
                            )
                          : ""}
                      </p>
                    </div>
                  </div>
                  <StarRow rating={review.rating || 0} />
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                    "{review.comment}"
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
