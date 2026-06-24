"use client"

import { OffersService, AdminService, orderBy, onSnapshot, where } from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { type Offer } from "@/src/types"
import { formatPrice } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tag, Check, X, ArrowLeftRight, Loader2, Clock } from "lucide-react"
const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  countered: "bg-blue-100 text-blue-800",
  expired: "bg-gray-100 text-gray-600" }

export function SellerOffersInbox() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [counterOffer, setCounterOffer] = useState<{ offerId: string; amount: string } | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return }
    const q = AdminService._ref_("offers", [where("sellerId", "==", user.uid),
      orderBy("createdAt", "desc")
    ])
    const unsub = onSnapshot(
      q,
      snap => {
        setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Offer)))
        setLoading(false)
        setError(null)
      },
      err => {
        console.error("[SellerOffersInbox]", err)
        setLoading(false)
        // Missing index gives a "requires an index" message — surface it clearly
        if (err.message?.includes("index")) {
          setError("Database index building — offers will appear shortly. Refresh in a minute.")
        } else {
          setError("Could not load offers. Please refresh the page.")
        }
      }
    )
    return unsub
  }, [user?.uid])

  const handle = async (offerId: string, action: "accepted" | "declined" | "countered", counterAmount?: number) => {
    setProcessing(offerId)
    try {
      await OffersService.respondToOffer(offerId, action, counterAmount)
      toast({
        title: action === "accepted" ? "Offer Accepted! 🎉" : action === "declined" ? "Offer Declined" : "Counter Sent!",
        variant: action === "declined" ? "destructive" : "success"
      })
      setCounterOffer(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
      <Clock className="h-8 w-8 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">{error}</p>
      <button onClick={() => window.location.reload()} className="text-xs text-primary underline">Refresh</button>
    </div>
  )

  const pending = offers.filter(o => o.status === "pending")
  const others = offers.filter(o => o.status !== "pending")

  return (
    <div className="space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <Tag className="h-4 w-4 text-primary" /> Offers Received
        {pending.length > 0 && <Badge className="bg-primary text-white">{pending.length} new</Badge>}
      </h2>

      {offers.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-8">No offers yet. They'll appear here when buyers make offers on your listings.</p>
      )}

      {[...pending, ...others].map(offer => {
        const discount = Math.round((1 - offer.offerAmount / offer.originalPrice) * 100)
        const isProcessing = processing === offer.id

        return (
          <div key={offer.id} className="border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                {offer.listingImage && (
                  <img src={offer.listingImage} alt="" className="h-12 w-12 rounded object-cover" />
                )}
                <div>
                  <p className="font-medium text-sm line-clamp-1">{offer.listingTitle}</p>
                  <p className="text-xs text-muted-foreground">From {offer.buyerName}</p>
                </div>
              </div>
              <Badge className={statusColors[offer.status]}>{offer.status}</Badge>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Asking</p>
                <p className="font-semibold">{formatPrice(offer.originalPrice)}</p>
              </div>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Offer ({discount}% off)</p>
                <p className="font-bold text-primary">{formatPrice(offer.offerAmount)}</p>
              </div>
              {offer.counterAmount && (
                <>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Your Counter</p>
                    <p className="font-semibold text-blue-600">{formatPrice(offer.counterAmount)}</p>
                  </div>
                </>
              )}
            </div>

            {offer.message && (
              <p className="text-xs text-muted-foreground italic bg-muted/30 p-2 rounded">"{offer.message}"</p>
            )}

            {offer.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" disabled={isProcessing}
                  onClick={() => handle(offer.id, "accepted")}>
                  {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Accept</>}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={isProcessing}
                  onClick={() => setCounterOffer({ offerId: offer.id, amount: "" })}>
                  <ArrowLeftRight className="h-3 w-3 mr-1" /> Counter
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" disabled={isProcessing}
                  onClick={() => handle(offer.id, "declined")}>
                  <X className="h-3 w-3 mr-1" /> Decline
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {/* Counter offer dialog */}
      <Dialog open={!!counterOffer} onOpenChange={() => setCounterOffer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Counter Offer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter your counter price. The buyer will be notified.</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
              <Input
                type="number"
                value={counterOffer?.amount || ""}
                onChange={e => setCounterOffer(prev => prev ? { ...prev, amount: e.target.value } : null)}
                className="pl-7"
                placeholder="Your counter price"
              />
            </div>
            <Button className="w-full bg-primary text-white"
              disabled={!counterOffer?.amount || processing === counterOffer?.offerId}
              onClick={() => counterOffer && handle(counterOffer.offerId, "countered", Math.round(parseFloat(counterOffer.amount) * 100))}>
              Send Counter Offer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
