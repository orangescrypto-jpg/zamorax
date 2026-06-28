"use client"
// components/reviews/ReviewForm.tsx
// Buyer submits a star rating + comment after order completes.
// Saves to "reviews" collection and marks order.buyerReviewed = true.

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReviewFormProps {
  orderId: string
  sellerId: string
  sellerName: string
  onDone: () => void
}

export function ReviewForm({ orderId, sellerId, sellerName, onDone }: ReviewFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!user?.uid || rating === 0) return
    setSaving(true)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          sellerId,
          buyerName: user.fullName || user.email || "Buyer",
          rating,
          comment: comment.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(err.error ?? "Failed to submit review")
      }
      toast({ title: "Review submitted! ⭐ Thank you.", variant: "success" })
      onDone()
    } catch (e: any) {
      toast({ title: "Could not submit review", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"]

  return (
    <div className="space-y-3">
      {/* Star picker */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Rating for {sellerName}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  star <= (hovered || rating)
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted-foreground/30"
                )}
              />
            </button>
          ))}
          {(hovered || rating) > 0 && (
            <span className="ml-2 text-sm font-medium text-amber-600 self-center">
              {LABELS[hovered || rating]}
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      <Textarea
        placeholder="Share your experience with this seller (optional)…"
        value={comment}
        onChange={e => setComment(e.target.value)}
        rows={3}
        maxLength={400}
        className="resize-none text-sm"
      />
      <p className="text-[10px] text-muted-foreground text-right">{comment.length}/400</p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDone}
          disabled={saving}
          className="flex-1"
        >
          Skip
        </Button>
        <Button
          size="sm"
          disabled={rating === 0 || saving}
          onClick={handleSubmit}
          className="flex-1 bg-primary hover:bg-primary/90 text-white"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Review"}
        </Button>
      </div>
    </div>
  )
}
