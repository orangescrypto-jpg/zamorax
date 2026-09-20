"use client"
// app/(admin)/admin/layaway-plans/page.tsx
// Admin and moderator can both see every layaway plan and how far each
// buyer has progressed. Cancelled/expired plans awaiting refund are
// filtered out here since those live on their own dedicated page at
// /admin/layaway-refunds -- this page is for the currently active book.
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, ArrowLeft, CalendarClock } from "lucide-react"
import { adminFetch } from "@/lib/admin-fetch"
import { formatPrice } from "@/lib/utils"

interface Plan {
  id: string
  order_id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  total_amount: number
  amount_paid: number
  status: string
  expires_at: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  defaulted: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
  expired: "bg-amber-100 text-amber-700",
}

export default function AdminLayawayPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("active")

  useEffect(() => {
    setLoading(true)
    adminFetch(`/api/admin/layaway-plans?status=${filter}`)
      .then(r => r.json())
      .then(json => setPlans(json.plans ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="container py-8 max-w-4xl space-y-5 pb-32">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-heading font-bold">Layaway Plans</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track how each buyer is progressing on their layaway payments.
        </p>
      </div>

      <div className="flex gap-2">
        {["active", "completed", "defaulted", "cancelled", "expired"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No {filter} layaway plans right now.
          </CardContent>
        </Card>
      ) : (
        plans.map((plan) => {
          const percent = Math.min(100, Math.round((plan.amount_paid / plan.total_amount) * 100))
          return (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    Order {plan.order_id.slice(0, 8)}
                  </span>
                  <Badge className={STATUS_COLORS[plan.status] || "bg-gray-100"}>{plan.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{formatPrice(plan.amount_paid)} of {formatPrice(plan.total_amount)} paid</span>
                  <span className="text-muted-foreground">{percent}%</span>
                </div>
                <Progress value={percent} />
                <p className="text-xs text-muted-foreground">
                  Deadline: {new Date(plan.expires_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
