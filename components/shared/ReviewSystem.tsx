"use client"

import { useState, useEffect } from "react"
import { AdminService, where, orderBy } from "@/src/services"
import { useAuth } from "@/hooks/useAuth"
import { Star, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { toDate } from "@/lib/toDate"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface Review {
  id: string
  reviewerId: string
  reviewerName: string
  sellerId: string
  orderId: string
  rating: number
  comment: string
  verified: boolean
  createdAt: any
}

interface ReviewSystemProps {
  sellerId: string
  orderId?: string // if provided, show write-review form
  showForm?: boolean
}

function StarRating({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          disabled={!onChange}
          className={cn("transition-colors", !onChange && "cursor-default")}
        >
          <Star
            className={cn(
              size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5",
              (hover || value) >= i ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function ReviewSystem({ sellerId, orderId, showForm }: ReviewSystemProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection(
      "reviews",
      docs => { setReviews(docs.docs.map(d => ({ id: d.id, ...d.data() })); setLoading(false) },
      [where("sellerId", "==", sellerId), orderBy("createdAt", "desc")]
    )
    return unsub
  }, [sellerId])

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, count: reviews.filter(r => r.rating === n).length }))

  const handleSubmit = async () => {
    if (!user || !orderId || rating === 0) return
    setSubmitting(true)
    try {
      await AdminService.addDoc("reviews", {
        reviewerId: user.uid,
        reviewerName: user.fullName || user.email || "Buyer",
        sellerId,
        orderId,
        rating,
        comment: comment.trim(),
        verified: true,
        createdAt: new Date(),
      })
      setSubmitted(true)
      toast({ title: "Review submitted!", description: "Thank you for your feedback." })
    } catch {
      toast({ title: "Failed to submit", variant: "destructive" })
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      {reviews.length > 0 && (
        <div className="flex gap-6 items-center p-4 bg-muted/50 rounded-2xl">
          <div className="text-center shrink-0">
            <p className="text-4xl font-black text-foreground">{avgRating.toFixed(1)}</p>
            <StarRating value={Math.round(avgRating)} size="sm" />
            <p className="text-xs text-muted-foreground mt-1">{reviews.length} reviews</p>
          </div>
          <div className="flex-1 space-y-1">
            {dist.map(({ n, count }) => (
              <div key={n} className="flex items-center gap-2">
                <span className="text-xs w-2">{n}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%" }} />
                </div>
                <span className="text-xs text-muted-foreground w-4">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write review form */}
      {showForm && orderId && user && !submitted && (
        <div className="border border-border rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold">Leave a Review</p>
          <StarRating value={rating} onChange={setRating} />
          <Textarea
            placeholder="Share your experience with this seller…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
          <Button onClick={handleSubmit} disabled={rating === 0 || submitting} size="sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Review
          </Button>
        </div>
      )}
      {submitted && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl p-3">
          <CheckCircle className="h-4 w-4" /> Review submitted — thank you!
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => (
            <div key={r.id} className="border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold">{r.reviewerName}</p>
                    {r.verified && <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><CheckCircle className="h-2.5 w-2.5" />Verified</span>}
                  </div>
                  <StarRating value={r.rating} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(toDate(r.createdAt), { addSuffix: true })}</p>
              </div>
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
