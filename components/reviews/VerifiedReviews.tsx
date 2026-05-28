"use client"

import {AdminService, query, limit, orderBy, where, serverTimestamp} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, ShieldCheck, Loader2, Camera } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"

interface Review {
  id: string
  buyerId: string
  buyerName: string
  sellerId: string
  listingId: string
  listingTitle: string
  rating: number
  comment: string
  photoUrls?: string[]
  orderId: string
  createdAt: string
  isVerifiedPurchase: boolean
}

interface VerifiedReviewsProps {
  sellerId: string
  listingId?: string // if passed, shows reviews for this listing only
}

export function VerifiedReviews({ sellerId, listingId }: VerifiedReviewsProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [canReview, setCanReview] = useState<{ orderId: string; listingTitle: string } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true)
      try {
        const constraints: import("firebase/firestore").QueryConstraint[] = [
          where("sellerId", "==", sellerId),
          where("isVerifiedPurchase", "==", true),
          orderBy("createdAt", "desc"),
          limit(20),
        ]
        if (listingId) constraints.splice(1, 0, where("listingId", "==", listingId))

        const snap = await AdminService.getCollection("reviews", [...constraints])
        setReviews(docs.map(d => ({ ...d } as Review)))
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    fetchReviews()
  }, [sellerId, listingId])

  // Check if current buyer has a completed order from this seller that hasn't been reviewed
  useEffect(() => {
    if (!user?.uid || user.uid === sellerId) return

    const checkEligibility = async () => {
      try {
        const ordersQ = await AdminService.getCollection("orders", [where("buyerId", "==", user.uid]),
          where("sellerId", "==", sellerId),
          where("status", "==", "completed"),
          limit(5)
        )
        const ordersSnap = await AdminService.getCollection(ordersQ)

        for (const orderDoc of ordersSnap.docs) {
          const orderId = orderDoc.id
          const orderData = orderDoc.data()

          // Check if review already written for this order
          const existingQ = await AdminService.getCollection("reviews", [where("orderId", "==", orderId]),
            where("buyerId", "==", user.uid)
          )
          const existingSnap = await AdminService.getCollection(existingQ)

          if (existingSnap.empty) {
            setCanReview({
              orderId,
              listingTitle: orderData.listingTitle || "your purchase" })
            break
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
    checkEligibility()
  }, [user?.uid, sellerId])

  const handleSubmit = async () => {
    if (!user?.uid || !canReview) return
    if (comment.trim().length < 10) {
      toast({ title: "Review too short", description: "Please write at least 10 characters.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      await AdminService.addDoc("reviews", {
        buyerId: user.uid,
        buyerName: user.fullName || user.email || "Buyer",
        sellerId,
        listingId: listingId || null,
        listingTitle: canReview.listingTitle,
        orderId: canReview.orderId,
        rating,
        comment: comment.trim(),
        isVerifiedPurchase: true,
        createdAt: serverTimestamp() })

      toast({ title: "Review submitted!", description: "Thank you for your verified review.", variant: "success" })
      setShowForm(false)
      setCanReview(null)
      setComment("")
      setRating(5)

      // Optimistically add to list
      setReviews(prev => [{
        id: "temp-" + Date.now(),
        buyerId: user.uid,
        buyerName: user.fullName || "You",
        sellerId,
        listingId: listingId || "",
        listingTitle: canReview.listingTitle,
        orderId: canReview.orderId,
        rating,
        comment: comment.trim(),
        isVerifiedPurchase: true,
        createdAt: { toDate: () => new Date() } }, ...prev])
    } catch (e) {
      toast({ title: "Error submitting review", variant: "destructive" })
    }
    setSubmitting(false)
  }

  const StarRow = ({ value, interactive = false }: { value: number; interactive?: boolean }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && setRating(i)}
          onMouseEnter={() => interactive && setHoverRating(i)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            className={`h-${interactive ? "6" : "3.5"} w-${interactive ? "6" : "3.5"} transition-colors ${
              i <= (interactive ? hoverRating || rating : value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-secondary">Verified Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-1.5">
              <StarRow value={Math.round(avgRating)} />
              <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({reviews.length})</span>
            </div>
          )}
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
          <ShieldCheck className="h-3 w-3" /> Verified Purchases Only
        </Badge>
      </div>

      {/* Write a review CTA */}
      {canReview && !showForm && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-secondary">You bought from this seller</p>
            <p className="text-xs text-muted-foreground">Share your experience with "{canReview.listingTitle}"</p>
          </div>
          <Button size="sm" className="bg-primary text-white shrink-0" onClick={() => setShowForm(true)}>
            Write Review
          </Button>
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-medium text-sm">Your Review</h3>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Rating</p>
            <StarRow value={rating} interactive />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Your experience</p>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe your experience with this seller and item..."
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">{comment.length}/500 characters</p>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1 bg-primary text-white" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Review"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Star className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No verified reviews yet</p>
          <p className="text-xs mt-1">Only buyers who completed a purchase can review</p>
        </div>
      )}

      <div className="space-y-3">
        {reviews.map(review => (
          <div key={review.id} className="bg-card border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">
                    {(review.buyerName || "B")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium leading-tight">{review.buyerName}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StarRow value={review.rating} />
                    <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] px-1.5 py-0 gap-0.5">
                      <ShieldCheck className="h-2.5 w-2.5" /> Verified
                    </Badge>
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {review.createdAt?.toDate ? formatDistanceToNow(review.createdAt.toDate(), { addSuffix: true }) : ""}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
            {review.listingTitle && (
              <p className="text-[11px] text-muted-foreground/60 italic">on "{review.listingTitle}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

