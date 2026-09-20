"use client"
// components/layaway/LayawayCancelDialog.tsx
// Shown on a buyer's active layaway plan (on the order detail page or
// inside LayawayPlansCard). Two steps:
//   1. Confirm -- fetches the exit fee quote from GET
//      /api/orders/layaway-cancel and shows exactly how much will be
//      deducted before asking the buyer to proceed.
//   2. Bank details -- once confirmed, asks for the account to refund
//      into. For the fastest refund, this should be the same account the
//      buyer used to fund their first payment on this plan.
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { AlertTriangle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"

interface LayawayCancelDialogProps {
  planId: string
  onCancelled?: () => void
  trigger?: React.ReactNode
}

interface Quote {
  amountPaid: number
  exitFeeKobo: number
  exitFeeType: "percent" | "flat"
  exitFeePercent: number
  netRefundKobo: number
}

export function LayawayCancelDialog({ planId, onCancelled, trigger }: LayawayCancelDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"confirm" | "bank">("confirm")
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")

  const openDialog = async () => {
    setOpen(true)
    setStep("confirm")
    setLoadingQuote(true)
    try {
      const res = await fetch(`/api/orders/layaway-cancel?planId=${planId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load cancellation details")
      setQuote(json)
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
      setOpen(false)
    } finally {
      setLoadingQuote(false)
    }
  }

  const proceedToBankDetails = () => setStep("bank")

  const submitCancellation = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      toast({ title: "Please fill in all bank details", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/orders/layaway-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          originalFundingNote:
            "Buyer states this is the same account used to fund the first payment on this plan.",
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not cancel plan")
      toast({
        title: "Plan cancelled",
        description: "Your refund is now under review and will be paid to the account you provided.",
      })
      setOpen(false)
      onCancelled?.()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <span onClick={openDialog}>
        {trigger ?? <Button variant="destructive" size="sm">Cancel Plan</Button>}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {step === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Cancel this layaway plan?
                </DialogTitle>
              </DialogHeader>
              {loadingQuote ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : quote ? (
                <div className="space-y-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    You have paid {formatPrice(quote.amountPaid)} so far on this plan. If you cancel now,
                    a layaway exit fee applies, as agreed to at checkout.
                  </p>
                  <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount paid</span>
                      <span>{formatPrice(quote.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>
                        Exit fee
                        {quote.exitFeeType === "percent" ? ` (${quote.exitFeePercent}%)` : " (flat)"}
                      </span>
                      <span>- {formatPrice(quote.exitFeeKobo)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-border/60 pt-1.5">
                      <span>You will receive</span>
                      <span>{formatPrice(quote.netRefundKobo)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This amount will be refunded manually to your bank account. Please note that
                    for the fastest processing, you should provide the same account you used to
                    make your first payment on this plan.
                  </p>
                </div>
              ) : null}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Keep My Plan</Button>
                <Button variant="destructive" onClick={proceedToBankDetails} disabled={!quote}>
                  Yes, Cancel Plan
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "bank" && (
            <>
              <DialogHeader>
                <DialogTitle>Where should we send your refund?</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-xs text-muted-foreground">
                  For the fastest processing, please provide the same bank account you used to
                  make your first payment on this plan.
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
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setStep("confirm")}>Back</Button>
                <Button variant="destructive" onClick={submitCancellation} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Cancellation"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default LayawayCancelDialog
