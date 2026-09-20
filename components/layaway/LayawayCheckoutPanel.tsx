"use client"
// components/layaway/LayawayCheckoutPanel.tsx
// Shown on the listing detail page next to the normal Buy Now button,
// only when platformSettings.layawayEnabled is true AND the listing has
// layawayEnabled set. The buyer picks a payment method for their deposit
// exactly the way BuyNowModal already does -- only the methods the admin
// has turned on (paystackCardEnabled/paystackBankEnabled,
// flutterwavePaymentEnabled, manualPaymentEnabled) are offered here.
//
// Paystack and Flutterwave follow the same sessionStorage draft pattern
// as BuyNowModal (pending_order_<reference>) but under their own key
// (pending_layaway_<reference>) and post to /api/orders/create-layaway on
// return instead of create-verified-*.
//
// Manual bank transfer cannot be verified automatically, so it takes a
// different path: /api/orders/create-layaway-manual creates the order and
// plan immediately in a "pending admin confirmation" state, shows the
// buyer the bank details to transfer to, and the plan only becomes active
// once an admin confirms the transfer was received (see
// app/api/admin/layaway-manual-confirm/route.ts). The plan's deadline
// only starts counting from that confirmation, not from when the buyer
// first requested it, so no one is penalised for review time.
//
// No goods are ever marked shipped or delivered until the plan is 100%
// paid -- see app/api/orders/layaway-pay/route.ts.
//
// DESIGN NOTE -- Buy Now only, never cart, quantity is inside one plan:
// Layaway is deliberately kept out of the cart flow. The cart groups
// items by seller and settles one combined payment across possibly many
// sellers and quantities in a single checkout. A layaway plan needs one
// locked total, one seller, one deadline, and one deposit tied to one
// order -- mixing that into the cart's multi-seller split-payout logic
// would make it unclear which portion of a part-payment belongs to which
// item if the buyer only pays part of a combined cart total. So:
//   - Layaway is only offered from the listing detail page (Buy Now path).
//   - A buyer choosing more than one of the same item still gets exactly
//     one plan, one deposit, and one deadline -- the deposit and total
//     simply scale with quantity, the same way BuyNowModal already
//     scales its own totals for bulk-qty purchases.
//   - A second, different listing on layaway is always its own separate
//     plan with its own deposit and deadline, shown as its own card on
//     the buyer's dashboard (see LayawayPlansCard.tsx), so progress on
//     one plan never gets confused with another.

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, Info, Landmark, CreditCard, CheckCircle2, Upload, ImageIcon, X, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useSubSettings } from "@/hooks/useSubSettings"
import { useToast } from "@/components/ui/use-toast"
import { PaystackPaymentService, FlutterwavePaymentService } from "@/src/services/payment"
import { StorageService } from "@/src/services"
import { computeRequiredDeposit } from "@/lib/layaway-deposit"
import { formatPrice } from "@/lib/utils"

type PayMethod = "paystack" | "flutterwave" | "manual"

interface LayawayCheckoutPanelProps {
  listing: {
    id: string
    title: string
    images?: string[]
    sellerId: string
    sellerName?: string
    nigerianState?: string
    layawayEnabled?: boolean
    layawayDepositType?: "percent" | "flat" | null
    layawayMinDepositPercent?: number | null
    layawayMinDepositFlatKobo?: number | null
    layawayMaxDays?: number | null
    stockQty?: number | null
  }
  priceKobo: number
  sellerStoreName?: string
  platformFeeKobo: number
  sellerPayoutKobo: number
  buyerFeeKobo: number
  buyerFeeLabel?: string
}

export function LayawayCheckoutPanel({
  listing, priceKobo, sellerStoreName, platformFeeKobo, sellerPayoutKobo, buyerFeeKobo, buyerFeeLabel,
}: LayawayCheckoutPanelProps) {
  const { user } = useAuth()
  const { settings, loading } = usePlatformSettings()
  const { settings: subSettings, loading: subLoading } = useSubSettings()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [qty, setQty] = useState(1)
  const [manualResult, setManualResult] = useState<{ bankDetails: any; depositKobo: number; planId: string } | null>(null)
  const [method, setMethod] = useState<PayMethod>("paystack")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle")
  const [proofSubmitting, setProofSubmitting] = useState(false)
  const [proofSubmitted, setProofSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableMethods: PayMethod[] = []
  if (settings.paystackCardEnabled || settings.paystackBankEnabled) availableMethods.push("paystack")
  if (settings.flutterwavePaymentEnabled) availableMethods.push("flutterwave")
  if (settings.manualPaymentEnabled) availableMethods.push("manual")

  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.includes(method)) {
      setMethod(availableMethods[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.paystackCardEnabled, settings.paystackBankEnabled, settings.flutterwavePaymentEnabled, settings.manualPaymentEnabled])

  if (loading || subLoading || !settings.layawayEnabled || !listing.layawayEnabled) return null
  if (availableMethods.length === 0) return null

  const maxQty = listing.stockQty != null && listing.stockQty > 0 ? listing.stockQty : 99
  const totalKobo = priceKobo * qty
  const totalPlatformFeeKobo = platformFeeKobo * qty
  const totalSellerPayoutKobo = sellerPayoutKobo * qty
  const totalBuyerFeeKobo = buyerFeeKobo * qty

  const { depositType, depositPercent, requiredDepositKobo: itemDepositKobo, maxDays } = computeRequiredDeposit(
    {
      layaway_min_deposit_type: listing.layawayDepositType ?? "percent",
      layaway_min_deposit_percent: listing.layawayMinDepositPercent,
      layaway_min_deposit_flat_kobo: listing.layawayMinDepositFlatKobo,
      layaway_max_days: listing.layawayMaxDays,
    },
    totalKobo,
    settings,
  )
  const depositKobo = itemDepositKobo + totalBuyerFeeKobo

  const exitFeeText = subSettings.layawayExitFeeType === "percent"
    ? `${subSettings.layawayExitFeePercent}% of the amount you have paid so far`
    : formatPrice(subSettings.layawayExitFeeFlatKobo)

  const buildOrderDraft = () => ({
    buyerId: user?.uid,
    buyerName: user?.fullName || user?.email,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName ?? "Seller",
    sellerStoreName: sellerStoreName ?? "",
    listingId: listing.id,
    itemTitle: listing.title,
    itemImage: listing.images?.[0] ?? "",
    totalAmount: totalKobo,
    platformFee: totalPlatformFeeKobo,
    sellerPayout: totalSellerPayoutKobo,
    buyerFee: totalBuyerFeeKobo,
    sellerState: listing.nigerianState ?? "",
    itemPrice: priceKobo,
    qty,
  })

  const handleOnlinePayment = async (provider: "paystack" | "flutterwave") => {
    if (!user?.uid || !user?.email) {
      toast({ title: "Please log in again", description: "Your session may have expired.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const activeService = provider === "paystack" ? PaystackPaymentService : FlutterwavePaymentService
      const orderDraft = buildOrderDraft()

      const paymentResult = await activeService.initializePayment({
        purpose: "order",
        amount: depositKobo,
        email: user.email,
        userId: user.uid,
        metadata: { listingId: listing.id, orderDraft, isLayawayDeposit: true },
        callbackUrl: `${window.location.origin}/dashboard/buyer/orders`,
      })

      try {
        sessionStorage.setItem(`pending_layaway_${paymentResult.reference_code}`, JSON.stringify(orderDraft))
      } catch { /* sessionStorage unavailable */ }

      if (!paymentResult.redirectUrl) {
        throw new Error(`${provider} did not return a redirect URL. Please try again.`)
      }
      window.location.href = paymentResult.redirectUrl
    } catch (err: any) {
      toast({ title: "Could not start layaway", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleManualPayment = async () => {
    if (!user?.uid) {
      toast({ title: "Please log in again", description: "Your session may have expired.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const orderDraft = buildOrderDraft()
      const res = await fetch("/api/orders/create-layaway-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderDraft),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not start layaway")
      setManualResult({ bankDetails: json.bankDetails, depositKobo: json.depositKobo, planId: json.planId })
    } catch (err: any) {
      toast({ title: "Could not start layaway", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" })
      return
    }
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
  }

  const removeProof = () => {
    setProofFile(null)
    setProofPreview(null)
    setUploadProgress("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSubmitProof = async () => {
    if (!manualResult || !user?.uid) return
    if (!proofFile) {
      toast({
        title: "Upload your payment proof",
        description: "Please attach a screenshot or photo of your transfer receipt.",
        variant: "destructive",
      })
      return
    }
    setProofSubmitting(true)
    try {
      setUploadProgress("uploading")
      const ext = proofFile.name.split(".").pop() || "jpg"
      const path = `payment-proofs/${user.uid}/${manualResult.planId}_${Date.now()}.${ext}`
      const { url } = await StorageService.uploadFile(proofFile, path)
      setUploadProgress("done")

      const res = await fetch("/api/orders/layaway-attach-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: manualResult.planId, proofUrl: url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not submit proof")
      setProofSubmitted(true)
    } catch (err: any) {
      setUploadProgress("idle")
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setProofSubmitting(false)
    }
  }

  const handleStartLayaway = () => {
    if (!agreed) {
      toast({ title: "Please accept the layaway agreement to continue", variant: "destructive" })
      return
    }
    if (method === "manual") {
      handleManualPayment()
    } else {
      handleOnlinePayment(method)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <CalendarClock className="h-4 w-4 mr-2" />
        Pay In Installments (Layaway)
      </Button>
    )
  }

  if (manualResult) {
    return (
      <div className="rounded-xl border border-border/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold">Deposit request created</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Please transfer {formatPrice(manualResult.depositKobo)} to the account below. Your layaway
          plan will be activated once an admin confirms your transfer.
        </p>
        <div className="rounded-lg border border-border/60 p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{manualResult.bankDetails.bankName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Account Number</span><span className="font-medium">{manualResult.bankDetails.accountNumber}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span>{manualResult.bankDetails.accountName}</span></div>
        </div>

        {proofSubmitted ? (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-700">
              Payment proof submitted. Admin has been notified and will confirm your deposit shortly.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Upload payment proof <span className="text-destructive">*</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProofSelect}
            />
            {proofPreview ? (
              <div className="relative rounded-lg border border-border overflow-hidden bg-muted/40">
                <img src={proofPreview} alt="Payment proof" className="w-full max-h-40 object-contain" />
                {uploadProgress === "uploading" && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs font-medium text-primary">Uploading...</span>
                  </div>
                )}
                {uploadProgress === "done" && (
                  <div className="absolute top-1.5 right-1.5">
                    <Badge className="bg-green-600 text-white gap-1 text-[10px]">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Uploaded
                    </Badge>
                  </div>
                )}
                {!proofSubmitting && uploadProgress !== "uploading" && (
                  <button
                    onClick={removeProof}
                    className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80 transition"
                    aria-label="Remove proof"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1.5 hover:border-primary hover:bg-primary/5 transition"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Tap to attach receipt or screenshot</span>
                <span className="text-[10px] text-muted-foreground">JPG, PNG, WEBP, max 5 MB</span>
              </button>
            )}
            <Button
              className="w-full"
              onClick={handleSubmitProof}
              disabled={!proofFile || proofSubmitting}
            >
              {proofSubmitting ? "Submitting..." : "Submit Proof"}
            </Button>
          </div>
        )}

        <Button variant="ghost" className="w-full" onClick={() => setOpen(false)} disabled={!proofSubmitted}>
          Done
        </Button>
        {!proofSubmitted && (
          <p className="text-xs text-center text-amber-600 font-medium">
            Upload and submit your payment screenshot to continue
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Layaway Plan</p>
      </div>
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
        <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Pay a {depositType === "flat" ? formatPrice(depositKobo) : `${depositPercent}%`} deposit now, then top up anytime from your orders page.
          The item stays with the seller and is only shipped once you have paid the full amount,
          within {maxDays} days of your deposit. You can put more than one unit on the same
          plan, but this plan covers only this one listing.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Quantity</Label>
        <Input
          type="number"
          min={1}
          max={maxQty}
          value={qty}
          onChange={(e) => {
            const v = Math.max(1, Math.min(maxQty, Math.floor(Number(e.target.value) || 1)))
            setQty(v)
          }}
          className="max-w-[100px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Payment Method</Label>
        <div className="flex gap-2">
          {availableMethods.includes("paystack") && (
            <Button
              type="button" size="sm"
              variant={method === "paystack" ? "default" : "outline"}
              onClick={() => setMethod("paystack")}
              className="flex-1"
            >
              <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Paystack
            </Button>
          )}
          {availableMethods.includes("flutterwave") && (
            <Button
              type="button" size="sm"
              variant={method === "flutterwave" ? "default" : "outline"}
              onClick={() => setMethod("flutterwave")}
              className="flex-1"
            >
              <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Flutterwave
            </Button>
          )}
          {availableMethods.includes("manual") && (
            <Button
              type="button" size="sm"
              variant={method === "manual" ? "default" : "outline"}
              onClick={() => setMethod("manual")}
              className="flex-1"
            >
              <Landmark className="h-3.5 w-3.5 mr-1.5" /> Bank Transfer
            </Button>
          )}
        </div>
        {method === "manual" && (
          <p className="text-xs text-muted-foreground pt-1">
            Bank transfer deposits are confirmed by an admin, which can take a little longer than
            an instant card payment. Your plan's deadline starts once the deposit is confirmed.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Deposit due now</Label>
        <Input readOnly value={formatPrice(depositKobo)} className="font-semibold" />
      </div>
      {totalBuyerFeeKobo > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border/60 px-3 py-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Includes {formatPrice(totalBuyerFeeKobo)} {buyerFeeLabel || "Buyer Protection & Escrow Fee"}, a one time payment. The rest, {formatPrice(itemDepositKobo)}, counts toward your item.
          </p>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Total price ({qty} unit{qty > 1 ? "s" : ""})</Label>
        <Input readOnly value={formatPrice(totalKobo)} />
      </div>

      <div className="rounded-lg border border-border/60 p-3 space-y-2">
        <p className="text-xs font-medium">Layaway Agreement</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          If you cancel this plan before completing full payment, or if you do not complete
          full payment before the deadline, your payment will be refunded to you minus a
          layaway exit fee of {exitFeeText}. Refunds are processed manually to the bank
          account you used to make your first payment on this plan.
        </p>
        <label className="flex items-start gap-2 text-xs cursor-pointer pt-1">
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
          <span>I understand and agree to these layaway terms.</span>
        </label>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={handleStartLayaway} disabled={submitting || !agreed}>
          {submitting ? "Starting..." : `Pay Deposit (${formatPrice(depositKobo)})`}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}

export default LayawayCheckoutPanel
