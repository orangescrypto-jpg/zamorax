"use client"
// components/dashboard/LayawayPlansCard.tsx
// Buyer dashboard card showing active layaway plans and letting the buyer
// top up toward the balance at any amount, any time. Offers whichever
// payment methods the admin has turned on: Paystack, Flutterwave, or
// manual bank transfer. Paystack/Flutterwave call
// /api/orders/layaway-pay after the provider redirect verifies the
// payment. Manual transfer calls /api/orders/layaway-pay-manual, which
// records the top up as pending until an admin confirms it was received.
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { CalendarClock, Loader2, Landmark } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useToast } from "@/components/ui/use-toast"
import { PaystackPaymentService, FlutterwavePaymentService } from "@/src/services/payment"
import { formatPrice } from "@/lib/utils"

interface LayawayPlan {
  id: string
  order_id: string
  listing_id: string
  total_amount: number
  amount_paid: number
  status: string
  expires_at: string
}

export function LayawayPlansCard() {
  const { user } = useAuth()
  const { settings } = usePlatformSettings()
  const { toast } = useToast()
  const [plans, setPlans] = useState<LayawayPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({})
  const [paying, setPaying] = useState<string | null>(null)
  const [manualInstructions, setManualInstructions] = useState<{ planId: string; bankDetails: any } | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    fetch("/api/orders/layaway-plans?role=buyer")
      .then(r => r.json())
      .then(json => setPlans((json.plans ?? []).filter((p: LayawayPlan) => p.status === "active")))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.uid])

  const availableMethods: Array<"paystack" | "flutterwave" | "manual"> = []
  if (settings.paystackCardEnabled || settings.paystackBankEnabled) availableMethods.push("paystack")
  if (settings.flutterwavePaymentEnabled) availableMethods.push("flutterwave")
  if (settings.manualPaymentEnabled) availableMethods.push("manual")

  const validateAmount = (plan: LayawayPlan): number | null => {
    const raw = topUpAmounts[plan.id]
    const amountNaira = Number(raw)
    if (!amountNaira || amountNaira <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" })
      return null
    }
    const amountKobo = Math.round(amountNaira * 100)
    const remaining = plan.total_amount - plan.amount_paid
    if (amountKobo > remaining) {
      toast({ title: "Amount too high", description: `Only ${formatPrice(remaining)} remaining on this plan.`, variant: "destructive" })
      return null
    }
    return amountKobo
  }

  const handleTopUp = async (plan: LayawayPlan, provider: "paystack" | "flutterwave") => {
    if (!user?.uid || !user?.email) return
    const amountKobo = validateAmount(plan)
    if (!amountKobo) return

    setPaying(plan.id)
    try {
      const activeService = provider === "paystack" ? PaystackPaymentService : FlutterwavePaymentService
      const paymentResult = await activeService.initializePayment({
        purpose: "order",
        amount: amountKobo,
        email: user.email,
        userId: user.uid,
        metadata: { isLayawayTopUp: true, planId: plan.id },
        callbackUrl: `${window.location.origin}/dashboard/buyer/orders?layawayTopUp=${plan.id}`,
      })
      try {
        sessionStorage.setItem(`pending_layaway_topup_${paymentResult.reference_code}`, plan.id)
      } catch { /* sessionStorage unavailable */ }
      if (!paymentResult.redirectUrl) throw new Error("Could not start payment. Please try again.")
      window.location.href = paymentResult.redirectUrl
    } catch (err: any) {
      toast({ title: "Payment failed to start", description: err.message, variant: "destructive" })
      setPaying(null)
    }
  }

  const handleManualTopUp = async (plan: LayawayPlan) => {
    const amountKobo = validateAmount(plan)
    if (!amountKobo) return

    setPaying(plan.id)
    try {
      const res = await fetch("/api/orders/layaway-pay-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, amountKobo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not request top up")
      setManualInstructions({ planId: plan.id, bankDetails: json.bankDetails })
    } catch (err: any) {
      toast({ title: "Could not request top up", description: err.message, variant: "destructive" })
    } finally {
      setPaying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (plans.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          Active Layaway Plans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plans.map((plan) => {
          const percent = Math.min(100, Math.round((plan.amount_paid / plan.total_amount) * 100))
          const remaining = plan.total_amount - plan.amount_paid
          const dueDate = new Date(plan.expires_at).toLocaleDateString()

          if (manualInstructions?.planId === plan.id) {
            return (
              <div key={plan.id} className="space-y-2 rounded-lg border border-border/60 p-3">
                <p className="text-xs font-medium">Transfer to complete your top up</p>
                <div className="rounded-lg border border-border/60 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span>{manualInstructions.bankDetails.bankName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account Number</span><span className="font-medium">{manualInstructions.bankDetails.accountNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span>{manualInstructions.bankDetails.accountName}</span></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your payment will be credited once an admin confirms the transfer.
                </p>
                <Button variant="ghost" size="sm" onClick={() => setManualInstructions(null)}>Done</Button>
              </div>
            )
          }

          return (
            <div key={plan.id} className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatPrice(plan.amount_paid)} of {formatPrice(plan.total_amount)} paid</span>
                <span>Due by {dueDate}</span>
              </div>
              <Progress value={percent} />
              <p className="text-xs text-muted-foreground">{formatPrice(remaining)} remaining</p>
              <Input
                type="number"
                placeholder="Amount to pay (naira)"
                className="text-xs"
                value={topUpAmounts[plan.id] ?? ""}
                onChange={e => setTopUpAmounts(p => ({ ...p, [plan.id]: e.target.value }))}
              />
              <div className="flex gap-2 flex-wrap">
                {availableMethods.includes("paystack") && (
                  <Button size="sm" onClick={() => handleTopUp(plan, "paystack")} disabled={paying === plan.id}>
                    {paying === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Paystack"}
                  </Button>
                )}
                {availableMethods.includes("flutterwave") && (
                  <Button size="sm" variant="outline" onClick={() => handleTopUp(plan, "flutterwave")} disabled={paying === plan.id}>
                    {paying === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Flutterwave"}
                  </Button>
                )}
                {availableMethods.includes("manual") && (
                  <Button size="sm" variant="outline" onClick={() => handleManualTopUp(plan)} disabled={paying === plan.id}>
                    {paying === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Landmark className="h-3 w-3 mr-1" />Bank Transfer</>}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default LayawayPlansCard
