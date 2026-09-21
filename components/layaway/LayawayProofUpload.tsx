"use client"
// components/layaway/LayawayProofUpload.tsx
// Screenshot upload for ONE manual bank-transfer top-up. Uploads the image
// to storage, then attaches it to that exact layaway_payments row through
// /api/orders/layaway-topup-proof (which also notifies admins).
//
// Used in two places so the upload logic exists once:
//   - LayawayTopUpForm, right after the buyer requests a bank transfer
//   - LayawayProgressTracker, for a pending transfer that still has no
//     proof (the buyer transferred first and screenshots later)
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, ImageIcon, X, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { StorageService } from "@/src/services"

interface LayawayProofUploadProps {
  planId: string
  paymentId: string
  /** Called after the proof is saved and admins are notified. */
  onSubmitted?: () => void
  /** Disables the parent's "Done"-style controls while busy. */
  onBusyChange?: (busy: boolean) => void
}

export function LayawayProofUpload({ planId, paymentId, onSubmitted, onBusyChange }: LayawayProofUploadProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "done">("idle")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setBusy = (busy: boolean) => {
    setSubmitting(busy)
    onBusyChange?.(busy)
  }

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!picked.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" })
      return
    }
    if (picked.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" })
      return
    }
    clearPreview()
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  const handleRemove = () => {
    clearPreview()
    setFile(null)
    setUploadState("idle")
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleSubmit = async () => {
    if (!user?.uid) return
    if (!file) {
      toast({
        title: "Upload your payment proof",
        description: "Please attach a screenshot or photo of your transfer receipt.",
        variant: "destructive",
      })
      return
    }
    setBusy(true)
    try {
      setUploadState("uploading")
      const ext = file.name.split(".").pop() || "jpg"
      const path = `payment-proofs/${user.uid}/${planId}_topup_${paymentId}_${Date.now()}.${ext}`
      const { url } = await StorageService.uploadFile(file, path)
      setUploadState("done")

      const res = await fetch("/api/orders/layaway-topup-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, proofUrl: url }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not submit proof")
      setSubmitted(true)
      onSubmitted?.()
    } catch (err: any) {
      setUploadState("idle")
      toast({ title: "Could not submit proof", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-xs text-green-800">
          Payment proof submitted. An admin has been notified and will credit your top up once the transfer is confirmed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium flex items-center gap-2">
        <ImageIcon className="h-3.5 w-3.5 text-primary" />
        Upload payment proof <span className="text-destructive">*</span>
      </p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} />
      {preview ? (
        <div className="relative rounded-lg border border-border overflow-hidden bg-muted/40">
          <img src={preview} alt="Payment proof" className="w-full max-h-40 object-contain" />
          {uploadState === "uploading" && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-medium text-primary">Uploading...</span>
            </div>
          )}
          {uploadState === "done" && (
            <div className="absolute top-1.5 right-1.5">
              <Badge className="bg-green-600 text-white gap-1 text-[10px]">
                <CheckCircle2 className="h-2.5 w-2.5" /> Uploaded
              </Badge>
            </div>
          )}
          {!submitting && uploadState !== "uploading" && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80 transition"
              aria-label="Remove proof"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1.5 hover:border-primary hover:bg-primary/5 transition"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tap to attach receipt or screenshot</span>
          <span className="text-[10px] text-muted-foreground">JPG, PNG, WEBP, max 5 MB</span>
        </button>
      )}
      <Button size="sm" className="w-full" onClick={handleSubmit} disabled={!file || submitting}>
        {submitting ? "Submitting..." : "Submit Proof"}
      </Button>
    </div>
  )
}

export default LayawayProofUpload
