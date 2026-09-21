"use client"
// components/layaway/LayawayTopUpForm.tsx
// Lets a buyer pay any amount toward the remaining balance of ONE active
// layaway plan. Offers whichever methods the admin has turned on:
// Paystack, Flutterwave, or manual bank transfer.
//
// Paystack / Flutterwave: we stash { planId, provider } in sessionStorage
// under pending_layaway_topup_<reference>, then redirect. The buyer comes
// back to /dashboard/buyer/orders/<orderId>?layawayTopUp=<planId>, where
// useLayawayTopUpReturn() (see hooks/useLayawayTopUpReturn.ts) verifies
// and credits the payment via /api/orders/layaway-topup-confirm.
//
// Manual transfer: /api/orders/layaway-pay-manual records the top-up as
// pending_admin_review and returns the bank details. It is only credited
// once an admin confirms the transfer was received.
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Landmark } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useToast } from "@/components/ui/use-toast"
import { PaystackPaymentService, FlutterwavePaymentService } from "@/src/services/payment"
import { formatPrice } from "@/lib/utils"

interface LayawayTopUpFormProps {
  planId: string
  orderId: string
  /** Remaining balance in kobo. */
  remainingKobo: number
  /** Called after a manual bank transfer request is recorded. */
  onManualRequested?: () => void
}

export function LayawayTopUpForm({ planId, orderId, remainingKobo, onManualRequested }: LayawayTopUpFormProps) {
  const { user } = useAuth()
  const { settings } = usePlatformSettings()
  const { toast } = useToast()
  const [amount, setAmount] = useState("")
  const [paying, setPaying] = useState<"paystack" | "flutterwave" | "manual" | null>(null)
  const [bankDetails, setBankDetails] = useState<any>(null)

  const availableMethods: Array<"paystack" | "flutterwave" | "manual"> = []
  if (settings.paystackCardEnabled || settings.paystackBankEnabled) availableMethods.push("paystack")
  if (settings.flutterwavePaymentEnabled) availableMethods.push("flutterwave")
  if (settings.manualPaymentEnabled) availableMethods.push("manual")

  const validateAmount = (): number | null => {
    const amountNaira = Number(amount)
    if (!amountNaira || amountNaira <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" })
      return null
    }
    const amountKobo = Math.round(amountNaira * 100)
    if (amountKobo > remainingKobo) {
      toast({
        title: "Amount too high",
        description: `Only ${formatPrice(remainingKobo)} remaining on this plan.`,
        variant: "destructive",
      })
      return null
    }
    return amountKobo
  }

  const handleOnline = async (provider: "paystack" | "flutterwave") => {
    if (!user?.uid || !user?.email) {
      toast({ title: "Please sign in again", variant: "destructive" })
      return
    }
    const amountKobo = validateAmount()
    if (!amountKobo) return

    setPaying(provider)
    try {
      const service = provider === "paystack" ? PaystackPaymentService : FlutterwavePaymentService
      const result = await service.initializePayment({
        purpose: "order",
        amount: amountKobo,
        email: user.email,
        userId: user.uid,
        metadata: { isLayawayTopUp: true, planId, orderId },
        callbackUrl: `${window.location.origin}/dashboard/buyer/orders/${orderId}?layawayTopUp=${planId}`,
      })
      if (!result.redirectUrl) throw new Error("Could not start payment. Please try again.")
      try {
        sessionStorage.setItem(
          `pending_layaway_topup_${result.reference_code}`,
          JSON.stringify({ planId, provider }),
        )
      } catch { /* sessionStorage unavailable */ }
      window.location.href = result.redirectUrl
    } catch (err: any) {
      toast({ title: "Payment failed to start", description: err.message, variant: "destructive" })
      setPaying(null)
    }
  }

  const handleManual = async () => {
    const amountKobo = validateAmount()
    if (!amountKobo) return

    setPaying("manual")
    try {
      const res = await fetch("/api/orders/layaway-pay-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, amountKobo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not request top up")
      setBankDetails(json.bankDetails)
      setAmount("")
      onManualRequested?.()
    } catch (err: any) {
      toast({ title: "Could not request top up", description: err.message, variant: "destructive" })
    } finally {
      setPaying(null)
    }
  }

  if (bankDetails) {
    return (
      <div className="space-y-2 rounded-lg border border-border/60 p-3">
        <p className="text-sm font-medium">Transfer to complete your top up</p>
        <div className="rounded-lg border border-border/60 p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{bankDetails.bankName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Account Number</span><span className="font-medium">{bankDetails.accountNumber}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span>{bankDetails.accountName}</span></div>
        </div>
        <p className="text-xs text-muted-foreground">
          Your payment will be credited once an admin confirms the transfer.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setBankDetails(null)}>Done</Button>
      </div>
    )
  }

  if (remainingKobo <= 0) return null

  if (availableMethods.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No payment methods are available right now. Please try again later.
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <p className="text-sm font-medium">Continue payment</p>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={`Amount to pay in naira (max ${formatPrice(remainingKobo)})`}
        className="text-sm"
        value={amount}
        onChange={e => setAmount(e.target.value)}
      />
      <div className="flex gap-2 flex-wrap">
        {availableMethods.includes("paystack") && (
          <Button size="sm" onClick={() => handleOnline("paystack")} disabled={paying !== null}>
            {paying === "paystack" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pay with Paystack"}
          </Button>
        )}
        {availableMethods.includes("flutterwave") && (
          <Button size="sm" variant="outline" onClick={() => handleOnline("flutterwave")} disabled={paying !== null}>
            {paying === "flutterwave" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pay with Flutterwave"}
          </Button>
        )}
        {availableMethods.includes("manual") && (
          <Button size="sm" variant="outline" onClick={handleManual} disabled={paying !== null}>
            {paying === "manual"
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <><Landmark className="h-3 w-3 mr-1" />Bank Transfer</>}
          </Button>
        )}
      </div>
    </div>
  )
}

export default LayawayTopUpForm
