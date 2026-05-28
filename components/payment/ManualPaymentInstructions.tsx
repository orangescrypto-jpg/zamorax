"use client"
// components/payment/ManualPaymentInstructions.tsx
// ─────────────────────────────────────────────────────────────────
// Shown to buyer when provider is "manual".
// Displays platform bank details + reference code buyer must quote.
// Has a "I've Paid" button that creates the order as pending.
// ─────────────────────────────────────────────────────────────────

import { useState } from "react"
import { Copy, CheckCircle2, Landmark, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import type { BankDetails } from "@/src/types/payment"

interface Props {
  amount: number              // kobo
  reference: string           // unique reference buyer must quote
  bankDetails: BankDetails | null
  onConfirmed: () => void     // called after buyer clicks "I've Paid"
  loading?: boolean
}

function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export function ManualPaymentInstructions({
  amount,
  reference,
  bankDetails,
  onConfirmed,
  loading = false,
}: Props) {
  const { toast } = useToast()
  const [copied, setCopied] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    toast({ title: `${label} copied!`, variant: "success" })
    setTimeout(() => setCopied(null), 2000)
  }

  const handleIPaid = async () => {
    setSubmitting(true)
    try {
      onConfirmed()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Landmark className="h-5 w-5 text-primary" />
        Transfer to this account
      </div>

      {/* Amount */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Amount to transfer</span>
        <span className="text-xl font-bold text-primary">{formatKobo(amount)}</span>
      </div>

      {/* Bank details */}
      {bankDetails ? (
        <div className="rounded-xl border bg-muted/40 divide-y divide-border overflow-hidden">

          <BankRow
            label="Bank Name"
            value={bankDetails.bankName}
            onCopy={() => copy(bankDetails.bankName, "Bank name")}
            copied={copied === "Bank name"}
          />
          <BankRow
            label="Account Number"
            value={bankDetails.accountNumber}
            onCopy={() => copy(bankDetails.accountNumber, "Account number")}
            copied={copied === "Account number"}
            mono
          />
          <BankRow
            label="Account Name"
            value={bankDetails.accountName}
            onCopy={() => copy(bankDetails.accountName, "Account name")}
            copied={copied === "Account name"}
          />

        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Bank details not configured yet. Please contact the admin.
        </div>
      )}

      {/* Reference code */}
      <div className="rounded-xl border bg-yellow-50 border-yellow-200 px-4 py-3 space-y-1.5">
        <p className="text-xs font-medium text-yellow-800 uppercase tracking-wide">
          ⚠️ Important — Use this as your payment reference
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold text-yellow-900 break-all">{reference}</span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            onClick={() => copy(reference, "Reference")}
          >
            {copied === "Reference"
              ? <CheckCircle2 className="h-3.5 w-3.5" />
              : <Copy className="h-3.5 w-3.5" />
            }
          </Button>
        </div>
        <p className="text-xs text-yellow-700">
          You must include this reference when making your transfer so we can identify your payment.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">After transferring:</p>
        <ol className="space-y-1.5 text-sm text-muted-foreground list-none">
          {[
            "Transfer the exact amount shown above",
            "Use the reference code in your bank transfer narration",
            'Click "I\'ve Paid" below — your order will be created',
            "Admin will confirm receipt and activate escrow (usually within a few hours)",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <Button
        className="w-full bg-primary text-white hover:bg-primary/90"
        onClick={handleIPaid}
        disabled={!bankDetails || submitting || loading}
      >
        {submitting || loading
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <CheckCircle2 className="h-4 w-4 mr-2" />
        }
        I've Paid — Create My Order
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your order will be created immediately but escrow activates only after admin confirms receipt.
      </p>
    </div>
  )
}

// ── Sub-component: single bank detail row ─────────────────────────
function BankRow({
  label,
  value,
  onCopy,
  copied,
  mono = false,
}: {
  label: string
  value: string
  onCopy: () => void
  copied: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      <button
        onClick={onCopy}
        className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        {copied
          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
          : <Copy className="h-4 w-4" />
        }
      </button>
    </div>
  )
}
