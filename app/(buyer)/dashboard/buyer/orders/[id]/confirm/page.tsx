"use client"

import { AdminService , serverTimestamp } from "@/src/services"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Star, CheckCircle, ShieldCheck, Loader2, ArrowLeft, AlertTriangle } from "lucide-react"
import { updateDoc } from "@/src/services"

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="focus:outline-none"
        >
          <Star
            className={`h-7 w-7 transition-colors ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  )
}

export default function ConfirmDeliveryPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [rating, setRating] = useState(0)
  const [review, setReview] = useState("")
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = async () => {
    if (!user?.uid) return
    if (rating === 0) {
      toast({ title: "Please leave a rating", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      await AdminService.updateDoc("orders", params.id, {
        status: "completed",
        buyerConfirmedAt: serverTimestamp(),
        buyerRating: rating,
        buyerReview: review.trim() || null,
        updatedAt: serverTimestamp(),
      })
      setConfirmed(true)
      toast({
        title: "Delivery Confirmed!",
        description: "Payment has been released to the seller. Thank you!",
        variant: "success",
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (confirmed) return (
    <div className="container max-w-md py-16 text-center space-y-4">
      <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <CheckCircle className="h-10 w-10 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-heading font-bold">Payment Released!</h1>
      <p className="text-muted-foreground">
        The seller has been paid. Thank you for shopping on Zamorax.
      </p>
      <Button asChild className="w-full bg-primary text-white hover:bg-primary/90">
        <a href="/dashboard/buyer/orders">Back to Orders</a>
      </Button>
    </div>
  )

  return (
    <div className="container max-w-md py-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-heading font-bold">Confirm Delivery</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Only confirm if you have received your item and are satisfied.
        </p>
      </div>

      {/* Escrow release notice */}
      <Alert className="border-blue-200 bg-blue-50">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 text-sm">
          Confirming delivery will <strong>immediately release</strong> the escrow funds to the seller. 
          This action cannot be undone.
        </AlertDescription>
      </Alert>

      {/* Dispute option */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700 text-sm">
          If there is a problem with your order, <strong>do not confirm</strong>. Instead,{" "}
          <a href={`/dashboard/buyer/orders/${params.id}`} className="underline font-medium">
            go back and open a dispute
          </a>.
        </AlertDescription>
      </Alert>

      {/* Rating */}
      <Card>
        <CardHeader><CardTitle className="text-base">Rate Your Experience</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Overall Rating <span className="text-red-500">*</span></Label>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review">Review (optional)</Label>
            <Textarea
              id="review"
              placeholder="How was the item? Was the seller responsive?"
              value={review}
              onChange={e => setReview(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{review.length}/500</p>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full bg-primary text-white hover:bg-primary/90 h-12"
        onClick={handleConfirm}
        disabled={loading || rating === 0}
      >
        {loading
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirming...</>
          : <><CheckCircle className="h-4 w-4 mr-2" /> Confirm & Release Payment</>}
      </Button>
    </div>
  )
}
