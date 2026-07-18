"use client"
// components/subscription/SubscriptionCheckoutModal.tsx
// Subscription plan checkout — Starter/Pro upgrade payment.
// Mirrors the Boost Center's payment pattern: for manual transfer, only a
// pending_payments row + a "pending_payment" subscriptions row are created;
// the plan itself is only applied once payment is actually confirmed
// (admin confirm for manual, /api/subscriptions/activate for Paystack).
// This avoids ghost "active" plans for payments nobody completed.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { usePaymentMethods } from "@/hooks/usePaymentMethods"
import { PaymentMethodPicker } from "@/components/payment/PaymentMethodPicker"
import { ManualPaymentService, PaystackPaymentService, FlutterwavePaymentService } from "@/src/services/payment"
import { ManualPaymentInstructions } from "@/components/payment/ManualPaymentInstructions"
import { AdminService } from "@/src/services"
import type { BankDetails } from "@/src/types/payment"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ShieldCheck, Loader2, CreditCard, CheckCircle2, Sparkles } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  plan: "starter" | "pro"
  planLabel: string      // e.g. "Starter"
  priceKobo: number
  billingLabel: string   // e.g. "month"
}

export function SubscriptionCheckoutModal({ open, onClose, plan, planLabel, priceKobo, billingLabel }: Props) {
  const { user }     = useAuth()
  const router       = useRouter()
  const { toast }    = useToast()
  const { settings } = usePlatformSettings()

  const [step, setStep]       = useState<"payment" | "bank_details">("payment")
  const [loading, setLoading] = useState(false)

  const { methods: paymentMethods, selected: selectedMethod, selectedId: selectedProvider, setSelectedId: setSelectedProvider, showPicker } = usePaymentMethods(settings)

  const [pendingRef,         setPendingRef]         = useState<string | null>(null)
  const [pendingBankDetails, setPendingBankDetails] = useState<BankDetails | null>(null)
  const [pendingSubId,       setPendingSubId]       = useState<string | null>(null)

  const handleClose = () => {
    if (loading) return
    setStep("payment")
    setPendingRef(null); setPendingBankDetails(null); setPendingSubId(null)
    onClose()
  }

  const handlePay = async () => {
    if (!user?.uid || !user?.email) {
      toast({ title: "Please log in again", description: "Your session may have expired.", variant: "destructive" })
      return
    }
    if (!selectedMethod) {
      toast({ title: "Choose a payment method", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const activeService =
        selectedMethod.provider === "paystack"      ? PaystackPaymentService
        : selectedMethod.provider === "flutterwave" ? FlutterwavePaymentService
        : ManualPaymentService

      const paymentResult = await activeService.initializePayment({
        purpose:     "subscription",
        amount:      priceKobo,
        email:       user.email,
        userId:      user.uid,
        metadata:    { plan },
        callbackUrl: `${window.location.origin}/dashboard/seller/subscription/callback?plan=${plan}`,
        paystackChannel: selectedMethod.paystackChannel,
      })

      // Create the "subscriptions" row now — always pending_payment until
      // confirmed (admin for manual, /api/subscriptions/activate for
      // Paystack/Flutterwave on redirect back). "subscriptions" is
      // admin-only in the D1 proxy, so this must go through a server
      // route, not AdminService.
      const createRes = await fetch("/api/subscriptions/create-pending", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          plan,
          amount:           priceKobo,
          paymentReference: paymentResult.reference_code,
          paymentProvider:  selectedMethod.provider,
        }),
      })
      const createData = await createRes.json()
      if (!createRes.ok) throw new Error(createData.error || "Could not start subscription")
      const subscriptionId = createData.subscriptionId as string

      if (selectedMethod.provider === "paystack" || selectedMethod.provider === "flutterwave") {
        if (!paymentResult.redirectUrl) {
          throw new Error(`${selectedMethod.provider === "paystack" ? "Paystack" : "Flutterwave"} did not return a redirect URL. Please try again.`)
        }
        // Stash the subscriptionId so the callback page can activate the
        // plan once the gateway confirms the transaction succeeded.
        sessionStorage.setItem(`zmx_sub_${paymentResult.reference_code}`, subscriptionId)
        window.location.href = paymentResult.redirectUrl
        return
      }

      // Manual — patch subscriptionId onto the pending_payments row's
      // metadata (same pattern boost uses) so /admin/payments can find it,
      // then show bank transfer instructions.
      try {
        const pendingPayments = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
        const paymentRow = pendingPayments.find(r => String(r.reference) === paymentResult.reference_code)
        if (paymentRow) {
          const existingMeta = (() => {
            try { return JSON.parse(String(paymentRow.metadata ?? "{}")) } catch { return {} }
          })()
          await AdminService.updateDoc("pending_payments", String(paymentRow.id), {
            metadata: JSON.stringify({ ...existingMeta, subscriptionId }),
          })
        }
      } catch (err) {
        console.error("attach subscriptionId failed (non-blocking):", err)
      }

      setPendingSubId(subscriptionId)
      setPendingRef(paymentResult.reference_code)
      setPendingBankDetails((paymentResult as any).bankDetails ?? null)
      setStep("bank_details")
    } catch (err: any) {
      toast({ title: "Could not initialize payment", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmitted = async () => {
    toast({
      title: "Payment submitted!",
      description: "Your subscription is pending admin confirmation. You'll be notified once it's activated.",
      variant: "success",
    })
    handleClose()
    router.push("/dashboard/seller")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm sm:max-w-md mx-auto rounded-2xl p-0 gap-0 overflow-hidden max-h-[92dvh] flex flex-col">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span>Upgrade to {planLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-3">
          {step === "payment" ? (
            <>
              <div className="rounded-lg border bg-muted/20 divide-y text-sm">
                <div className="flex justify-between px-3 py-2.5">
                  <span className="font-semibold text-sm">{planLabel} plan</span>
                  <span className="text-primary font-bold text-sm">{formatPrice(priceKobo)} / {billingLabel}</span>
                </div>
              </div>

              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <CreditCard className="h-3 w-3" /> Payment
              </p>

              {showPicker ? (
                <PaymentMethodPicker
                  methods={paymentMethods}
                  selectedId={selectedProvider}
                  onSelect={setSelectedProvider}
                  name="subscriptionPaymentMethod"
                />
              ) : (
                <div className="rounded-lg border bg-muted/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Payment via {selectedMethod?.label ?? "—"}
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-emerald-700">
                  {selectedMethod?.provider === "manual"
                    ? "After paying, you'll see our bank details. Your plan activates once admin confirms your transfer."
                    : "You'll be redirected to complete payment securely. Your plan activates immediately after payment."}
                </p>
              </div>

              {/* Flutterwave/Paystack dashboards are set to "charge customer"
                  for processing fees, so the amount debited on the
                  customer's card/bank statement is slightly higher than the
                  price shown here. This note preempts "why was I charged
                  more?" support tickets. Not shown for manual bank transfer,
                  since that path isn't run through the gateway and has no
                  added fee. */}
              {selectedMethod?.provider !== "manual" && (
                <p className="text-[11px] text-muted-foreground text-center">
                  A small card/transfer processing fee may be added at checkout.
                </p>
              )}
            </>
          ) : (
            pendingRef && (
              <ManualPaymentInstructions
                amount={priceKobo}
                reference={pendingRef}
                bankDetails={pendingBankDetails}
                userId={user?.uid ?? ""}
                purpose="subscription"
                onConfirmed={handleManualSubmitted}
              />
            )
          )}
        </div>

        {step === "payment" && (
          <>
            <Separator />
            <div className="px-4 py-3 shrink-0">
              <Button
                className="w-full h-10 bg-primary text-white"
                disabled={loading || !selectedMethod}
                onClick={handlePay}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
                  : <>Pay {formatPrice(priceKobo)}</>}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
