"use client"
// components/layaway/LayawayProgressTracker.tsx
// Progress bar plus a list of every installment payment on a plan. Used
// on the seller's order detail page and the admin/moderator order or
// dispute views, so anyone with a legitimate reason to check can see
// exactly how much a buyer has paid and how much remains.
import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface Payment {
  id: string
  amount: number
  provider: string
  paid_at: string
}

interface PlanProgress {
  plan: {
    total_amount: number
    amount_paid: number
    status: string
    expires_at: string
  }
  payments: Payment[]
  remainingKobo: number
}

export function LayawayProgressTracker({ planId }: { planId: string }) {
  const [data, setData] = useState<PlanProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/orders/layaway-progress?planId=${planId}`)
      .then(r => r.json())
      .then(json => { if (!json.error) setData(json) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId])

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!data) return null

  const percent = Math.min(100, Math.round((data.plan.amount_paid / data.plan.total_amount) * 100))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{formatPrice(data.plan.amount_paid)} of {formatPrice(data.plan.total_amount)} paid</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <Progress value={percent} />
      <p className="text-xs text-muted-foreground">
        {formatPrice(data.remainingKobo)} remaining, due by {new Date(data.plan.expires_at).toLocaleDateString()}
      </p>

      {data.payments.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/60">
          <p className="text-xs font-medium text-muted-foreground">Payment history</p>
          {data.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span>{new Date(p.paid_at).toLocaleDateString()} via {p.provider}</span>
              <span className="font-medium">{formatPrice(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LayawayProgressTracker
