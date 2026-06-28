"use client"
// components/listings/BuyNowModal.tsx
// Buy Now modal — buyer places an order directly without chatting.
// Collects delivery address, calculates totals, creates order in Firestore,
// initialises payment (manual bank transfer or redirect provider), then
// sends buyer to the order detail page to complete payment.
//
// FEE CHANGES:
//   - Commission now reads from config/fees via useFeeSettings() (whole % number)
//   - Buyer convenience fee (e.g. ₦150) added if admin has enabled it
//   - All fee math uses calculateFees() helper for consistency with FeeBreakdown

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
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck, Loader2, MapPin, CreditCard,
  Truck, Package, AlertCircle, Info,
} from "lucide-react"
import { formatPrice } from "@/lib/utils"

// Nigerian states list
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

  // Accepted offer — if buyer negotiated a lower price, use that instead
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

  // Delivery address fields
  const [street, setStreet] = useState("")
  const [city,   setCity]   = useState("")
  const [state,  setState]  = useState("")
  const [lga,    setLga]    = useState("")

  // Use negotiated price if buyer has an accepted offer, otherwise listing price
  const itemPriceKobo = acceptedOffer ? acceptedOffer.agreedPrice : listing.priceSale

  // All fee math via shared helper — reads from admin-set values
  const breakdown = calculateFees(itemPriceKobo, "sale", fees)

  const sellerDisplayName =
    seller?.storeName || seller?.fullName || listing.sellerName || "Seller"

  // ── Step 1 validation ─────────────────────────────────────────
  const addressValid = street.trim() && city.trim() && state

  // ── Place order + init payment ────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!user?.uid || !user?.email) {
      toast({
        title: "Please log in again",
        description: "Your session may have expired. Log out and back in, then retry.",
        variant: "destructive",
      })
      return
    }
    setLoading(true)
    try {
      // 1. Create order
      const { id: orderId } = await OrdersService.createOrder({
        buyerId:              user.uid,
        buyerName:            user.fullName || user.email,
        sellerId:             listing.sellerId,
        sellerName:           sellerDisplayName,
        sellerStoreName:      seller?.storeName,
        listingId:            listing.id,
        itemTitle:            listing.title,
        itemImage:            listing.images?.[0],
        // Buyer pays item price + convenience fee (if enabled)
        totalAmount:          breakdown.buyerTotalKobo,
        // Platform commission deducted from seller payout
        platformFee:          breakdown.commissionKobo,
        sellerPayout:         breakdown.sellerPayoutKobo,
        status:               "pending",
        orderType:            "purchase",
        escrowStatus:         "pending",
        deliveryStreet:       street.trim(),
        deliveryCity:         city.trim(),
        deliveryState:        state,
        deliveryLGA:          lga.trim(),
        deliveryMethod:       "meetup",
        sellerState:          listing.nigerianState,
        buyerState:           state,
      })

      // 2. Initialise payment
      const paymentResult = await PaymentService.initializePayment({
        purpose:     "order",
        amount:      breakdown.buyerTotalKobo,
        email:       user.email,
        userId:      user.uid,
        metadata:    { orderId, listingId: listing.id },
        callbackUrl: `${window.location.origin}/dashboard/buyer/orders/${orderId}`,
      })

      // 3. Save payment reference on the order
      await OrdersService.updateOrderStatus(orderId, "pending", {
        paymentReference: paymentResult.reference_code,
        paymentProvider:  paymentResult.provider,
      })

      // 4. Redirect
      if (paymentResult.redirectUrl) {
        window.location.href = paymentResult.redirectUrl
      } else {
        router.push(`/dashboard/buyer/orders/${orderId}`)
      }

      // Mark the accepted offer as used
      if (acceptedOffer) {
        await OffersService.markOfferUsed(listing.id, user.uid)
      }

      onClose()
    } catch (err: any) {
      toast({
        title:       "Could not place order",
        description: err.message,
        variant:     "destructive",
      })
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] mx-4 sm:mx-auto max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base min-w-0">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Buy Now — Escrow Protected</span>
          </DialogTitle>
        </DialogHeader>

        {offerLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (<>

        {/* ── Step indicator ──────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {(["address", "review", "payment"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                ${step === s ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </span>
              <span className={`hidden xs:inline ${step === s ? "text-foreground font-medium" : ""}`}>
                {s === "address" ? "Delivery" : s === "review" ? "Review" : "Payment"}
              </span>
              {i < 2 && <span className="text-muted-foreground/40">›</span>}
            </div>
          ))}
        </div>

        <Separator />

        {/* ── Item summary (always visible) ───────────────────── */}
        <div className="flex items-center gap-3 py-1">
          {listing.images?.[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-14 h-14 rounded-lg object-cover shrink-0 border"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{listing.title}</p>
            <p className="text-xs text-muted-foreground">Sold by {sellerDisplayName}</p>
            {acceptedOffer ? (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-muted-foreground line-through text-xs">
                  {formatPrice(listing.priceSale)}
                </p>
                <p className="text-emerald-600 font-bold text-base">
                  {formatPrice(acceptedOffer.agreedPrice)}
                </p>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                  Negotiated
                </span>
              </div>
            ) : (
              <p className="text-primary font-bold text-base mt-0.5">
                {formatPrice(itemPriceKobo)}
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* ── Step 1: Delivery Address ─────────────────────────── */}
        {step === "address" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> DELIVERY ADDRESS
            </p>

            <div className="space-y-2">
              <div>
                <Label className="text-xs">Street Address *</Label>
                <Input
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  placeholder="e.g. 12 Allen Avenue"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="min-w-0">
                  <Label className="text-xs">City *</Label>
                  <Input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Ikeja"
                    className="mt-1 h-9 text-sm"
                  />
                </div>
                <div className="min-w-0">
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
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                You can also choose <strong>meetup</strong> with the seller after placing the order.
                Delivery method can be updated on the order page.
              </p>
            </div>

            <Button
              className="w-full bg-primary text-white h-10"
              disabled={!addressValid}
              onClick={() => setStep("review")}
            >
              Continue to Review
            </Button>
          </div>
        )}

        {/* ── Step 2: Order Review ─────────────────────────────── */}
        {step === "review" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" /> ORDER SUMMARY
            </p>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery to</span>
                <span className="font-medium text-right max-w-[55%] truncate">
                  {city}, {state}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Street</span>
                <span className="text-right max-w-[55%] text-xs truncate">
                  {street}{lga ? `, ${lga}` : ""}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item price</span>
                <span>{formatPrice(breakdown.itemPriceKobo)}</span>
              </div>
              {/* Buyer convenience fee — only shown if admin enabled it */}
              {breakdown.buyerConvenienceKobo > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {fees.buyerFeeLabel}
                    <Info className="h-3 w-3" />
                  </span>
                  <span>+{formatPrice(breakdown.buyerConvenienceKobo)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seller commission</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {breakdown.commissionPct.toFixed(1)}% (from seller)
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>You pay</span>
                <span className="text-primary">{formatPrice(breakdown.buyerTotalKobo)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
              <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700">
                Your payment is held in <strong>escrow</strong> and only released to the seller
                after you confirm receipt. You are fully protected.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-10" onClick={() => setStep("address")}>
                Back
              </Button>
              <Button
                className="flex-1 bg-primary text-white h-10"
                onClick={() => setStep("payment")}
              >
                Confirm Order
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Payment ──────────────────────────────────── */}
        {step === "payment" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> PAYMENT
            </p>

            <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span>Total to pay</span>
                <span className="text-primary text-base">
                  {formatPrice(breakdown.buyerTotalKobo)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Payment via {settings.activePaymentProvider === "manual"
                  ? "bank transfer (you'll see details on the next page)"
                  : settings.activePaymentProvider === "paystack"
                  ? "Paystack (card / bank)"
                  : "Flutterwave (card / bank)"}
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                {settings.activePaymentProvider === "manual"
                  ? "After placing your order, you will see our bank details. Transfer the exact amount and your order will be confirmed once we verify receipt."
                  : "You will be redirected to complete payment securely. Your order is saved and you can return if anything goes wrong."}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10"
                disabled={loading}
                onClick={() => setStep("review")}
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-primary text-white h-10"
                disabled={loading}
                onClick={handlePlaceOrder}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Placing order...</>
                  : <><span className="hidden sm:inline">Pay </span>{formatPrice(breakdown.buyerTotalKobo)}</>}
              </Button>
            </div>
          </div>
        )}
        </>)}
      </DialogContent>
    </Dialog>
  )
}
