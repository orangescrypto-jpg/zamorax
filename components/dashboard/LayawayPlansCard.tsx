"use client"
// components/dashboard/LayawayPlansCard.tsx
// Buyer dashboard summary of active layaway plans. Each plan links to its
// order page, which is where the buyer continues paying (amount input +
// Paystack / Flutterwave / bank transfer) and where the return from the
// payment gateway is verified and credited. Keeping the pay flow in ONE
// place (components/layaway/LayawayTopUpForm.tsx) means the dashboard and
// the order page can never drift out of sync.
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CalendarClock, Loader2, ChevronRight } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
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
  const [plans, setPlans] = useState<LayawayPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    fetch("/api/orders/layaway-plans?role=buyer")
      .then(r => r.json())
      .then(json => setPlans((json.plans ?? []).filter((p: LayawayPlan) => p.status === "active")))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.uid])

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
      <CardContent className="space-y-3">
        {plans.map((plan) => {
          const percent = Math.min(100, Math.round((plan.amount_paid / plan.total_amount) * 100))
          const remaining = plan.total_amount - plan.amount_paid
          const dueDate = new Date(plan.expires_at).toLocaleDateString()
          return (
            <div key={plan.id} className="space-y-2 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatPrice(plan.amount_paid)} of {formatPrice(plan.total_amount)} paid</span>
                <span>Due by {dueDate}</span>
              </div>
              <Progress value={percent} />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{formatPrice(remaining)} remaining</p>
                <Button asChild size="sm">
                  <Link href={`/dashboard/buyer/orders/${plan.order_id}`}>
                    Continue payment <ChevronRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default LayawayPlansCard
