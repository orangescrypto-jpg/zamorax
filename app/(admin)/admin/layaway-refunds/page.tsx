"use client"
// app/(admin)/admin/layaway-refunds/page.tsx
// Visible to both admin and moderator roles (route itself only requires
// requireModerator on the API side, and moderator role can already reach
// pages under (admin) per the existing routing pattern). Lists layaway
// plans awaiting a manual refund payout, with the buyer's bank details,
// and a button to mark the payout as sent once done outside the platform.
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Banknote, Copy } from "lucide-react"
import { adminFetch } from "@/lib/admin-fetch"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"

interface RefundPlan {
  id: string
  order_id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  total_amount: number
  amount_paid: number
  exit_fee_kobo: number
  refund_amount_kobo: number
  refund_status: string
  refund_bank_name: string
  refund_account_number: string
  refund_account_name: string
  refund_requested_at: string
  status: string
}

export default function AdminLayawayRefundsPage() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<RefundPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    adminFetch("/api/admin/layaway-refunds?status=pending_review")
      .then(r => r.json())
      .then(json => setPlans(json.plans ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const copyAccount = (accountNumber: string) => {
    navigator.clipboard.writeText(accountNumber)
    toast({ title: "Account number copied" })
  }

  const markPaid = async (planId: string) => {
    setProcessingId(planId)
    try {
      const res = await adminFetch(`/api/admin/layaway-refunds/${planId}/mark-paid`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to mark as refunded")
      toast({ title: "Marked as refunded", description: "The buyer has 24 hours to confirm receipt." })
      setPlans(prev => prev.filter(p => p.id !== planId))
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-3xl space-y-5 pb-32">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-heading font-bold">Layaway Refunds</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plans cancelled by a buyer or expired unpaid, awaiting a manual bank transfer refund.
          Pay the amount shown to the account provided, then click Mark As Refunded.
        </p>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No refunds pending review right now.
          </CardContent>
        </Card>
      ) : (
        plans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-primary" />
                  {formatPrice(plan.refund_amount_kobo)} to refund
                </span>
                <Badge variant={plan.status === "expired" ? "secondary" : "outline"}>
                  {plan.status === "expired" ? "Expired" : "Cancelled"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Amount paid</p>
                  <p>{formatPrice(plan.amount_paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Exit fee deducted</p>
                  <p>{formatPrice(plan.exit_fee_kobo)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Refund to</p>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{plan.refund_account_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{plan.refund_bank_name}</span>
                  <button
                    onClick={() => copyAccount(plan.refund_account_number)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {plan.refund_account_number} <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => markPaid(plan.id)}
                  disabled={processingId === plan.id}
                >
                  {processingId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark As Refunded"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
