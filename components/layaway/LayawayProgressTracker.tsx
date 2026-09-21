"use client"
// components/layaway/LayawayProgressTracker.tsx
// Progress bar plus a list of every installment payment on a plan. Used
// on the seller's order detail page and the admin/moderator order or
// dispute views, so anyone with a legitimate reason to check can see
// exactly how much a buyer has paid and how much remains.
//
// Pass allowProofUpload from the BUYER's own order page only. A pending
// manual bank transfer that has no proof yet then gets an "Upload proof"
// action, so a buyer who transferred first can screenshot later.
import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { LayawayProofUpload } from "@/components/layaway/LayawayProofUpload"

interface Payment {
  id: string
  amount: number
  provider: string
  paid_at: string
  status?: string
  proof_url?: string | null
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

export function LayawayProgressTracker({
  planId,
  allowProofUpload = false,
}: {
  planId: string
  allowProofUpload?: boolean
}) {
  const [data, setData] = useState<PlanProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  // Payments whose proof was just submitted in this session. Their row
  // stays visible (showing LayawayProofUpload's own confirmation) even
  // after a reload sets proof_url and would otherwise filter it out.
  const [justSubmitted, setJustSubmitted] = useState<Set<string>>(new Set())
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    fetch(`/api/orders/layaway-progress?planId=${planId}`)
      .then(r => r.json())
      .then(json => { if (!json.error) setData(json) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [planId, reloadKey])

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
              <span>
                {new Date(p.paid_at).toLocaleDateString()} via {p.provider}
                {p.status === "pending_admin_review" && (
                  <span className="ml-1.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800">
                    Awaiting confirmation
                  </span>
                )}
              </span>
              <span className={p.status === "pending_admin_review" ? "font-medium text-muted-foreground" : "font-medium"}>
                {formatPrice(p.amount)}
              </span>
            </div>
          ))}
          {allowProofUpload && data.payments
            .filter(p => p.status === "pending_admin_review" && p.provider === "manual" && (!p.proof_url || justSubmitted.has(p.id)))
            .map(p => (
              <div key={`proof-${p.id}`} className="space-y-2 rounded-lg border border-border/60 p-3">
                {uploadingFor === p.id || justSubmitted.has(p.id) ? (
                  <LayawayProofUpload
                    planId={planId}
                    paymentId={p.id}
                    onSubmitted={() => {
                      setJustSubmitted(prev => new Set(prev).add(p.id))
                      setReloadKey(k => k + 1)
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Transfer of {formatPrice(p.amount)} needs a payment receipt.
                    </p>
                    <button
                      type="button"
                      onClick={() => setUploadingFor(p.id)}
                      className="shrink-0 text-xs font-semibold text-primary underline underline-offset-2"
                    >
                      Upload proof
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default LayawayProgressTracker
