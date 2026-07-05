"use client"
// components/payment/ManualPaymentInstructions.tsx
// ─────────────────────────────────────────────────────────────────
// Shown to buyer when provider is "manual".
// Displays platform bank details + reference code buyer must quote.
// Buyer uploads proof of payment (screenshot/receipt).
// "I've Paid" button attaches proof, notifies all admins, creates order.
// ─────────────────────────────────────────────────────────────────

import { useState, useRef } from "react"
import {
  Copy, CheckCircle2, Landmark, AlertCircle,
  Loader2, Upload, ImageIcon, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { StorageService } from "@/src/services"
import type { BankDetails } from "@/src/types/payment"

interface Props {
  amount:      number              // kobo
  reference:   string              // unique reference buyer must quote
  bankDetails: BankDetails | null
  userId:      string              // buyer uid — needed for admin notification
  purpose:     "order" | "subscription" | "boost"
  onConfirmed: (proofUrl: string | null) => void | Promise<void>  // called after buyer submits
  loading?:    boolean
}

function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export function ManualPaymentInstructions({
  amount,
  reference,
  bankDetails,
  userId,
  purpose,
  onConfirmed,
  loading = false,
}: Props) {
  const { toast }                               = useToast()
  const [copied, setCopied]                     = useState<string | null>(null)
  const [submitting, setSubmitting]             = useState(false)
  // FIX: separate "creating order" state from "submitting" (upload + notify
  // admin). Previously the button re-enabled the instant upload/notify
  // finished, while onConfirmed (order creation, which can take a moment)
  // was still running unawaited in the background — a fast double-tap
  // could call onConfirmed twice and create two orders for one payment.
  // This also gives the buyer a "Payment received" state to look at while
  // the order is being created, instead of the button just looking idle.
  const [creatingOrder, setCreatingOrder]       = useState(false)
  const [proofFile, setProofFile]               = useState<File | null>(null)
  const [proofPreview, setProofPreview]         = useState<string | null>(null)
  const [uploadProgress, setUploadProgress]     = useState<"idle" | "uploading" | "done">("idle")
  const fileInputRef                            = useRef<HTMLInputElement>(null)

  // ── Copy helper ────────────────────────────────────────────────
  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    toast({ title: `${label} copied!`, variant: "success" })
    setTimeout(() => setCopied(null), 2000)
  }

  // ── Handle proof image selection ───────────────────────────────
  const handleProofSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Accept images only
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" })
      return
    }
    // 5 MB limit
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" })
      return
    }
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
  }

  const removeProof = () => {
    setProofFile(null)
    setProofPreview(null)
    setUploadProgress("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ── Upload proof via StorageService ────────────────────────────
  const uploadProof = async (): Promise<string | null> => {
    if (!proofFile) return null
    setUploadProgress("uploading")
    const ext  = proofFile.name.split(".").pop() || "jpg"
    const path = `payment-proofs/${userId}/${reference}_${Date.now()}.${ext}`
    const { url } = await StorageService.uploadFile(proofFile, path)
    setUploadProgress("done")
    return url
  }

  // ── "I've Paid" submit ─────────────────────────────────────────
  const handleIPaid = async () => {
    // FIX: guard at the very top, before any state updates or awaits, so a
    // double-tap on a slow device (two click events queued before the first
    // re-render disables the button) can never start a second run.
    if (submitting || creatingOrder) return

    if (!proofFile) {
      toast({
        title:       "Upload your payment proof",
        description: "Please attach a screenshot or photo of your transfer receipt.",
        variant:     "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      // 1. Upload proof image
      const proofUrl = await uploadProof()

      // 2. Notify admins + attach proofUrl to pendingPayments doc
      const res = await fetch("/api/payment/notify-admin", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reference, proofUrl, userId, purpose, amount }),
      })
      if (!res.ok) {
        const data = await res.json()
        // Non-fatal — admins not notified but we still let buyer proceed
        console.error("notify-admin error:", data.error)
      }

      // 3. Hand off to parent (creates order / activates next step).
      // FIX: this used to be a fire-and-forget call — setSubmitting(false)
      // in the finally block ran right after, re-enabling the button while
      // order creation was still in progress. Now we flip to a dedicated
      // "creating order" state and await the handoff, so the button stays
      // disabled (and shows "Payment received...") for the whole duration.
      setSubmitting(false)
      setCreatingOrder(true)
      await onConfirmed(proofUrl)
      // Deliberately no setCreatingOrder(false) here on the success path —
      // onConfirmed navigates away (router.push + modal close) once the
      // order exists, so leaving the button disabled/spinning until that
      // navigation lands is correct; flipping it back would just cause a
      // flash of an enabled button right before the page changes.
    } catch (err: any) {
      // FIX: uploadProgress was only ever set to "done" on success — if
      // uploadProof() threw (network error, 30s timeout, server 500), it
      // stayed stuck at "uploading" forever with no way to retry short of
      // a full page refresh, even though the toast below did fire.
      setUploadProgress("idle")
      setCreatingOrder(false)
      toast({ title: "Error", description: err.message, variant: "destructive" })
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

      {/* ── Proof of payment upload ──────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          Upload payment proof <span className="text-destructive">*</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Attach a screenshot or photo of your bank transfer receipt. This speeds up admin confirmation.
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleProofSelect}
        />

        {proofPreview ? (
          /* Preview card */
          <div className="relative rounded-xl border border-border overflow-hidden bg-muted/40">
            <img
              src={proofPreview}
              alt="Payment proof"
              className="w-full max-h-48 object-contain"
            />
            {/* Upload progress overlay */}
            {uploadProgress === "uploading" && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">Uploading…</span>
              </div>
            )}
            {uploadProgress === "done" && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-green-600 text-white gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" /> Uploaded
                </Badge>
              </div>
            )}
            {/* Remove button (only when not yet submitting) */}
            {!submitting && !creatingOrder && uploadProgress !== "uploading" && (
              <button
                onClick={removeProof}
                className="absolute top-2 left-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80 transition"
                aria-label="Remove proof"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {/* Retake button */}
            {!submitting && !creatingOrder && uploadProgress !== "uploading" && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 text-xs text-primary underline bg-background/80 px-2 py-0.5 rounded"
              >
                Change
              </button>
            )}
          </div>
        ) : (
          /* Upload tap area */
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition"
          >
            <Upload className="h-7 w-7 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tap to attach receipt / screenshot</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP · max 5 MB</span>
          </button>
        )}
      </div>
      {/* ── End proof upload ─────────────────────────────────────── */}

      {/* Steps */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">After transferring:</p>
        <ol className="space-y-1.5 text-sm text-muted-foreground list-none">
          {[
            "Transfer the exact amount shown above",
            "Use the reference code in your bank transfer narration",
            "Take a screenshot of the completed transfer",
            "Upload the screenshot above, then click \"I've Paid\"",
            "Admin will confirm and activate escrow (usually within a few hours)",
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
        disabled={!bankDetails || !proofFile || submitting || creatingOrder || loading}
      >
        {creatingOrder ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Payment received — creating your order…</>
        ) : submitting || loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <><CheckCircle2 className="h-4 w-4 mr-2" />I've Paid — Create My Order</>
        )}
      </Button>

      {!proofFile && !creatingOrder && (
        <p className="text-xs text-center text-amber-600 font-medium">
          ↑ Upload your payment screenshot to continue
        </p>
      )}

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
  label:  string
  value:  string
  onCopy: () => void
  copied: boolean
  mono?:  boolean
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
