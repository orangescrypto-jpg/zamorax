"use client"
// app/(admin)/admin/layaway-manual-pending/page.tsx
// Admin reviews layaway deposits and top ups paid by manual bank
// transfer, checks the proof of payment through the platform's usual
// bank statement process, enters the amount actually received, and
// confirms it. Confirming a deposit activates the plan and starts its
// deadline. Confirming a top up credits it toward the plan and completes
// the plan automatically if it reaches the full amount.
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, Landmark } from "lucide-react"
import { adminFetch } from "@/lib/admin-fetch"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"

interface PendingDeposit {
  id: string
  order_id: string
  buyer_id: string
  seller_id: string
  total_amount: number
  deposit_percent: number
  created_at: string
}

interface PendingTopup {
  id: string
  plan_id: string
  order_id: string
  amount: number
  total_amount: number
  amount_paid: number
  created_at: string
}

export default function AdminLayawayManualPendingPage() {
  const { toast } = useToast()
  const [deposits, setDeposits] = useState<PendingDeposit[]>([])
  const [topups, setTopups] = useState<PendingTopup[]>([])
  const [loading, setLoading] = useState(true)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    adminFetch("/api/admin/layaway-manual-pending")
      .then(r => r.json())
      .then(json => {
        setDeposits(json.deposits ?? [])
        setTopups(json.topups ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const confirmDeposit = async (planId: string) => {
    const naira = Number(amounts[planId])
    if (!naira || naira <= 0) {
      toast({ title: "Enter the amount received", variant: "destructive" })
      return
    }
    setConfirmingId(planId)
    try {
      const res = await adminFetch("/api/admin/layaway-manual-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, depositAmountReceivedKobo: Math.round(naira * 100) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to confirm")
      toast({ title: "Deposit confirmed", description: "The layaway plan is now active." })
      setDeposits(prev => prev.filter(p => p.id !== planId))
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setConfirmingId(null)
    }
  }

  const confirmTopup = async (paymentId: string) => {
    const naira = Number(amounts[paymentId])
    if (!naira || naira <= 0) {
      toast({ title: "Enter the amount received", variant: "destructive" })
      return
    }
    setConfirmingId(paymentId)
    try {
      const res = await adminFetch("/api/admin/layaway-manual-topup-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, amountReceivedKobo: Math.round(naira * 100) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to confirm")
      toast({
        title: json.completed ? "Plan completed" : "Top up confirmed",
        description: json.completed ? "The buyer has paid off this plan in full." : "The payment has been credited to the plan.",
      })
      setTopups(prev => prev.filter(t => t.id !== paymentId))
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-3xl space-y-6 pb-32">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-heading font-bold">Manual Layaway Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Buyers who chose to pay by bank transfer, for a new deposit or a top up on an existing plan.
          Check your bank statement for the transfer, then enter the amount received and confirm.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">New Deposits</h2>
        {deposits.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No deposits awaiting confirmation.</CardContent></Card>
        ) : (
          deposits.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4 text-primary" />
                  Order {plan.order_id.slice(0, 8)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Listing total</p>
                    <p>{formatPrice(plan.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Required deposit</p>
                    <p>{plan.deposit_percent}% (approx {formatPrice(Math.ceil(plan.total_amount * plan.deposit_percent / 100))})</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount actually received (naira)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. 15000"
                      value={amounts[plan.id] ?? ""}
                      onChange={e => setAmounts(prev => ({ ...prev, [plan.id]: e.target.value }))}
                    />
                    <Button onClick={() => confirmDeposit(plan.id)} disabled={confirmingId === plan.id}>
                      {confirmingId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Top Up Payments</h2>
        {topups.length === 0 ? (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No top ups awaiting confirmation.</CardContent></Card>
        ) : (
          topups.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4 text-primary" />
                  Order {t.order_id.slice(0, 8)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Plan progress so far</p>
                    <p>{formatPrice(t.amount_paid)} of {formatPrice(t.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Buyer requested to pay</p>
                    <p>{formatPrice(t.amount)}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount actually received (naira)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. 5000"
                      value={amounts[t.id] ?? ""}
                      onChange={e => setAmounts(prev => ({ ...prev, [t.id]: e.target.value }))}
                    />
                    <Button onClick={() => confirmTopup(t.id)} disabled={confirmingId === t.id}>
                      {confirmingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
