"use client"

import {AdminService, query, orderBy, onSnapshot, where, serverTimestamp} from "@/src/services"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Star, BadgeCheck, Image as ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface Review {
  id: string
  sellerId: string
  buyerId: string
  buyerName: string
  orderId: string
  rating: number
  comment: string
  photos: string[]
  verifiedPurchase: boolean
  createdAt: string
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" onClick={() => onChange?.(s)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`h-5 w-5 ${s <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  )
}

// ── Write a review (buyer, after order) ──────────────────────────────────────
export function WriteReviewModal({ sellerId, orderId, sellerName, open, onClose }: {
  sellerId: string; orderId: string; sellerName: string; open: boolean; onClose: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!user || !comment.trim()) return
    setLoading(true)
    try {
      // verify purchase
      const orderSnap = await AdminService.getDoc("orders", orderId)
      const isVerified = orderSnap.exists() && orderSnap.data()?.buyerId === user.uid && orderSnap.data()?.status === "completed"

      await AdminService.addDoc("reviews", {
        sellerId, buyerId: user.uid,
        buyerName: user.fullName || "Buyer",
        orderId, rating, comment: comment.trim(),
        photos: [], verifiedPurchase: isVerified,
        createdAt: serverTimestamp() })
      toast({ title: "Review submitted! ⭐", variant: "success" })
      onClose()
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Rate this Seller</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">How was your experience with <strong>{sellerName}</strong>?</p>
          <div className="flex flex-col items-center gap-2 py-2">
            <StarRating value={rating} onChange={setRating} />
            <p className="text-sm text-muted-foreground">{["","Poor","Fair","Good","Great","Excellent!"][rating]}</p>
          </div>
          <Textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Share your experience — product quality, delivery speed, communication..."
            className="resize-none h-24 text-sm" />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <BadgeCheck className="h-3 w-3 text-green-600" /> Verified Purchase badge is added automatically for completed orders.
          </p>
          <Button className="w-full bg-primary text-white" onClick={handleSubmit} disabled={loading || !comment.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
            Submit Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Display reviews on seller profile ────────────────────────────────────────
export function SellerReviews({ sellerId }: { sellerId: string }) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = AdminService._ref_("reviews", [where("sellerId", "==", sellerId), orderBy("createdAt", "desc")])
    return onSnapshot(q, docs => { setReviews(docs.docs.map(d => ({ id: d.id, ...d.data() } as Review))); setLoading(false) })
  }, [sellerId])

  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : "0"
  const dist = [5,4,3,2,1].map(s => ({ star: s, count: reviews.filter(r => r.rating === s).length }))

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  if (!reviews.length) return <p className="text-sm text-muted-foreground text-center py-6">No reviews yet. Be the first to review!</p>

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-xl">
        <div className="text-center">
          <p className="text-4xl font-bold">{avg}</p>
          <StarRating value={Math.round(Number(avg))} />
          <p className="text-xs text-muted-foreground mt-1">{reviews.length} reviews</p>
        </div>
        <div className="flex-1 space-y-1">
          {dist.map(d => (
            <div key={d.star} className="flex items-center gap-2 text-xs">
              <span className="w-4">{d.star}</span>
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <div className="flex-1 bg-muted rounded-full h-1.5">
                <div className="h-1.5 bg-amber-400 rounded-full" style={{ width: `${reviews.length ? (d.count / reviews.length) * 100 : 0}%` }} />
              </div>
              <span className="w-4 text-right">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual reviews */}
      {reviews.map(r => (
        <div key={r.id} className="border rounded-xl p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{r.buyerName}</p>
                {r.verifiedPurchase && (
                  <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                    <BadgeCheck className="h-3 w-3" /> Verified Purchase
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{r.createdAt?.toDate?.().toLocaleDateString() || "Recently"}</p>
            </div>
            <StarRating value={r.rating} />
          </div>
          <p className="text-sm text-secondary">{r.comment}</p>
        </div>
      ))}
    </div>
  )
}
