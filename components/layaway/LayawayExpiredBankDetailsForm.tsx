"use client"
// components/layaway/LayawayExpiredBankDetailsForm.tsx
// Fetches the plan's own refund status and renders whichever step
// applies, so parent pages can render this unconditionally once a
// layaway_plan_id exists on a cancelled/expired order without needing to
// know the plan's exact refund state themselves:
//   - awaiting_bank_details -- plan expired on its own (buyer never used
//     the cancel dialog, which already collects bank details). Shows the
//     bank details form.
//   - pending_review -- bank details already submitted, admin/moderator
//     have not paid yet. Shows a simple status message.
//   - paid -- admin/moderator marked it refunded. Shows a "Confirm I
//     received my refund" button with the 24 hour deadline.
//   - buyer_confirmed / auto_confirmed -- done. Shows a confirmation
//     message. The record itself is purged automatically some hours
//     after this, per the cron sweep.
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"

interface Props {
  planId: string
}

interface PlanState {
  refund_status: string | null
  refund_amount_kobo: number | null
  exit_fee_kobo: number | null
  amount_paid: number
  refund_confirm_deadline: string | null
}

export function LayawayExpiredBankDetailsForm({ planId }: Props) {
  const { toast } = useToast()
  const [plan, setPlan] = useState<PlanState | null>(null)
  const [loading, setLoading] = useState(true)
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/orders/layaway-progress?planId=${planId}`)
      .then(r => r.json())
      .then(json => { if (!json.error) setPlan(json.plan) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [planId])

  const submitBankDetails = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      toast({ title: "Please fill in all bank details", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/orders/layaway-expired-bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId, bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not submit bank details")
      toast({ title: "Bank details submitted", description: "Your refund is now under review." })
      load()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmReceipt = async () => {
    setConfirming(true)
    try {
      const res = await fetch("/api/orders/layaway-refund-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not confirm receipt")
      toast({ title: "Thank you", description: "Refund confirmed." })
      load()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!plan || !plan.refund_status) return null

  if (plan.refund_status === "awaiting_bank_details") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Refund Details Needed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Your layaway plan passed its deadline without full payment. Please provide your bank
            account below so we can process your refund. For the fastest processing, use the same
            account you used to make your first payment on this plan.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Bank Name</Label>
            <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. GTBank" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Account Number</Label>
            <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="10-digit account number" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Account Name</Label>
            <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Name on the account" />
          </div>
          <Button onClick={submitBankDetails} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Bank Details"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (plan.refund_status === "pending_review") {
    return (
      <Card>
        <CardContent className="py-4 flex items-start gap-2">
          <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Refund under review</p>
            <p className="text-xs text-muted-foreground">
              Your bank details have been received. {formatPrice(plan.refund_amount_kobo ?? 0)} will be paid out shortly.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (plan.refund_status === "paid") {
    return (
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Refund sent</p>
              <p className="text-xs text-muted-foreground">
                {formatPrice(plan.refund_amount_kobo ?? 0)} has been paid to your bank account.
                Please confirm you have received it within 24 hours.
              </p>
            </div>
          </div>
          <Button onClick={confirmReceipt} disabled={confirming} className="w-full">
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm I Received My Refund"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (plan.refund_status === "buyer_confirmed" || plan.refund_status === "auto_confirmed") {
    return (
      <Card>
        <CardContent className="py-4 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm">Refund confirmed. This record will be cleared automatically soon.</p>
        </CardContent>
      </Card>
    )
  }

  return null
}

export default LayawayExpiredBankDetailsForm
