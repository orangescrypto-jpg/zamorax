"use client"
// components/listings/BuyNowModal.tsx
// Buy Now modal — compact Jumia-style layout.
// Small header, item row, then step content. Sticky action buttons at bottom.

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useFeeSettings } from "@/hooks/useFeeSettings"
import { calculateFees } from "@/src/services/feeSettings"
import { OrdersService } from "@/src/services/orders"
import { PaymentService } from "@/src/services/payment"
import { OffersService } from "@/src/services"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  ShieldCheck, Loader2, MapPin, CreditCard,
  Truck, Package, AlertCircle,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

const NG_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
]

interface Props {
  open: boolean
  onClose: () => void
  listing: {
    id: string
    title: string
    priceSale: number
    images?: string[]
    sellerId: string
    sellerName?: string
    sellerStoreName?: string
    nigerianState?: string
  }
  seller?: {
    fullName?: string
    storeName?: string
  } | null
}

export function BuyNowModal({ open, onClose, listing, seller }: Props) {
  const { user }     = useAuth()
  const router       = useRouter()
  const { toast }    = useToast()
  const { settings } = usePlatformSettings()
  const { fees }     = useFeeSettings()

  const [step,    setStep]    = useState<"address" | "review" | "payment">("address")
  const [loading, setLoading] = useState(false)

  const [acceptedOffer, setAcceptedOffer] = useState<{
    offerId: string
    agreedPrice: number
    originalPrice: number
    acceptedAt: string
  } | null>(null)
  const [offerLoading, setOfferLoading] = useState(true)

  useEffect(() => {
    if (!open || !user?.uid) { setOfferLoading(false); return }
    setOfferLoading(true)
    OffersService.getAcceptedOffer(listing.id, user.uid)
      .then(offer => setAcceptedOffer(offer))
      .catch(() => setAcceptedOffer(null))
      .finally(() => setOfferLoading(false))
  }, [open, listing.id, user?.uid])

  const [street, setStreet] = useState("")
  const [city,   setCity]   = useState("")
  const [state,  setState]  = useState("")
  const [lga,    setLga]    = useState("")

  const itemPriceKobo = acceptedOffer ? acceptedOffer.agreedPrice : listing.priceSale
  const breakdown     = calculateFees(itemPriceKobo, "sale", fees)

  const sellerDisplayName =
    seller?.storeName || seller?.fullName || listing.sellerName || "Seller"

  const addressValid = street.trim() && city.trim() && state

  const handlePlaceOrder = async () => {
    if (!user?.uid || !user?.email) {
      toast({ title: "Please log in again", description: "Your session may have expired.", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const { id: orderId } = await OrdersService.createOrder({
        buyerId:         user.uid,
        buyerName:       user.fullName || user.email,
        sellerId:        listing.sellerId,
        sellerName:      sellerDisplayName,
        sellerStoreName: seller?.storeName,
        listingId:       listing.id,
        itemTitle:       listing.title,
        itemImage:       listing.images?.[0],
        totalAmount:     breakdown.buyerTotalKobo,
        platformFee:     breakdown.commissionKobo,
        sellerPayout:    breakdown.sellerPayoutKobo,
        status:          "pending",
        orderType:       "purchase",
        escrowStatus:    "pending",
        deliveryStreet:  street.trim(),
        deliveryCity:    city.trim(),
        deliveryState:   state,
        deliveryLGA:     lga.trim(),
        deliveryMethod:  "meetup",
        sellerState:     listing.nigerianState,
        buyerState:      state,
      })

      const paymentResult = await PaymentService.initializePayment({
        purpose:     "order",
        amount:      breakdown.buyerTotalKobo,
        email:       user.email,
        userId:      user.uid,
        metadata:    { orderId, listingId: listing.id },
        callbackUrl: `${window.location.origin}/dashboard/buyer/orders/${orderId}`,
      })

      await OrdersService.updateOrderStatus(orderId, "pending", {
        paymentReference: paymentResult.reference_code,
        paymentProvider:  paymentResult.provider,
      })

      if (acceptedOffer) await OffersService.markOfferUsed(listing.id, user.uid)

      if (paymentResult.redirectUrl) {
        window.location.href = paymentResult.redirectUrl
      } else {
        router.push(`/dashboard/buyer/orders/${orderId}`)
      }

      onClose()
    } catch (err: any) {
      toast({ title: "Could not place order", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setStep("address")
    setStreet(""); setCity(""); setState(""); setLga("")
    onClose()
  }

  const STEPS = ["address", "review", "payment"] as const

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {/* Compact modal — max-h keeps it within viewport, no oversized padding */}
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm sm:max-w-md mx-auto rounded-2xl p-0 gap-0 overflow-hidden max-h-[92dvh] flex flex-col">

        {/* ── Header ─────────────────────────────────────────────── */}
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Buy Now — Escrow Protected</span>
          </DialogTitle>
          {/* Step pills */}
          <div className="flex items-center gap-1.5 mt-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                  ${step === s ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </span>
                {i < 2 && <span className="text-muted-foreground/40 text-xs">›</span>}
              </div>
            ))}
            <span className="text-xs text-muted-foreground ml-1 capitalize">
              {step === "address" ? "Delivery" : step === "review" ? "Review" : "Payment"}
            </span>
          </div>
        </DialogHeader>

        <Separator />

        {/* ── Item row — always visible, compact ─────────────────── */}
        {!offerLoading && (
          <div className="flex items-center gap-3 px-4 py-2.5 shrink-0">
            {listing.images?.[0] ? (
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-11 h-11 rounded-lg object-cover shrink-0 border"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {/* Title truncates — no overflow */}
              <p className="font-medium text-xs leading-tight truncate">{listing.title}</p>
              <p className="text-[11px] text-muted-foreground">by {sellerDisplayName}</p>
              {acceptedOffer ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-muted-foreground line-through text-xs">{formatPrice(listing.priceSale)}</span>
                  <span className="text-emerald-600 font-bold text-sm">{formatPrice(acceptedOffer.agreedPrice)}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded">Negotiated</span>
                </div>
              ) : (
                <p className="text-primary font-bold text-sm mt-0.5">{formatPrice(itemPriceKobo)}</p>
              )}
            </div>
          </div>
        )}

        <Separator />

        {/* ── Scrollable step content ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {offerLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Step 1 — Delivery Address */}
              {step === "address" && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <MapPin className="h-3 w-3" /> Delivery Address
                  </p>
                  <div>
                    <Label className="text-xs">Street Address *</Label>
                    <Input
                      value={street}
                      onChange={e => setStreet(e.target.value)}
                      placeholder="e.g. 12 Allen Avenue"
                      className="mt-1 h-9 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">City *</Label>
                      <Input
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="e.g. Ikeja"
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">LGA</Label>
                      <Input
                        value={lga}
                        onChange={e => setLga(e.target.value)}
                        placeholder="e.g. Ikeja LGA"
                        className="mt-1 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">State *</Label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="mt-1 w-full h-9 text-sm border rounded-md px-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select state</option>
                      {NG_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-blue-700">
                      You can also arrange <strong>meetup</strong> with the seller after placing your order.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2 — Review */}
              {step === "review" && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <Truck className="h-3 w-3" /> Order Summary
                  </p>
                  <div className="rounded-lg border bg-muted/20 divide-y text-sm">
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground text-xs">Delivery to</span>
                      <span className="font-medium text-xs text-right max-w-[55%] truncate">{city}, {state}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground text-xs">Street</span>
                      <span className="text-xs text-right max-w-[55%] truncate">{street}{lga ? `, ${lga}` : ""}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground text-xs">Item price</span>
                      <span className="text-xs">{formatPrice(breakdown.itemPriceKobo)}</span>
                    </div>
                    {breakdown.buyerConvenienceKobo > 0 && (
                      <div className="flex justify-between px-3 py-2">
                        <span className="text-muted-foreground text-xs">{fees.buyerFeeLabel}</span>
                        <span className="text-xs">+{formatPrice(breakdown.buyerConvenienceKobo)}</span>
                      </div>
                    )}
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground text-xs">Delivery (meetup)</span>
                      <span className="text-xs text-emerald-600 font-medium">Free</span>
                    </div>
                    <div className="flex justify-between px-3 py-2.5">
                      <span className="font-bold text-sm">Grand Total</span>
                      <span className="font-bold text-primary text-sm">{formatPrice(breakdown.buyerTotalKobo)}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-emerald-700">
                      Your payment is held in <strong>escrow</strong> and only released to the seller after you confirm receipt. You are fully protected.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3 — Payment */}
              {step === "payment" && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <CreditCard className="h-3 w-3" /> Payment
                  </p>
                  <div className="rounded-lg border bg-muted/20 divide-y text-sm">
                    <div className="flex justify-between px-3 py-2.5">
                      <span className="font-semibold text-sm">Total to pay</span>
                      <span className="text-primary font-bold text-sm">{formatPrice(breakdown.buyerTotalKobo)}</span>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        Payment via {settings.activePaymentProvider === "manual"
                          ? "bank transfer (you'll see details on the next page)"
                          : settings.activePaymentProvider === "paystack"
                          ? "Paystack (card / bank)"
                          : "Flutterwave (card / bank)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700">
                      {settings.activePaymentProvider === "manual"
                        ? "After placing your order, you will see our bank details. Your order is activated once admin confirms your transfer."
                        : "You will be redirected to complete payment securely."}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Sticky action buttons — always visible at bottom ─────── */}
        {!offerLoading && (
          <>
            <Separator />
            <div className="px-4 py-3 shrink-0">
              {step === "address" && (
                <Button
                  className="w-full h-10 bg-primary text-white"
                  disabled={!addressValid}
                  onClick={() => setStep("review")}
                >
                  Continue to Review
                </Button>
              )}
              {step === "review" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-none px-5 h-10" onClick={() => setStep("address")}>
                    ‹ Back
                  </Button>
                  <Button className="flex-1 h-10 bg-primary text-white" onClick={() => setStep("payment")}>
                    Confirm & Pay via Bank Transfer
                  </Button>
                </div>
              )}
              {step === "payment" && (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-none px-5 h-10" disabled={loading} onClick={() => setStep("review")}>
                    ‹ Back
                  </Button>
                  <Button
                    className="flex-1 h-10 bg-primary text-white"
                    disabled={loading}
                    onClick={handlePlaceOrder}
                  >
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Placing order...</>
                      : <>Pay {formatPrice(breakdown.buyerTotalKobo)}</>}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
