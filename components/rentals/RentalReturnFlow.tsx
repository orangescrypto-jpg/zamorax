"use client"

import { AdminService, serverTimestamp } from "@/src/services"
import { auth, storage } from "@/lib/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle, Upload, AlertTriangle, Camera,
  RotateCcw, Shield, Loader2, X
} from "lucide-react"
import { cn } from "@/lib/utils"

type ReturnCondition = "perfect" | "minor_wear" | "damaged" | "missing"

const CONDITION_OPTIONS: { value: ReturnCondition; label: string; color: string; description: string }[] = [
  { value: "perfect", label: "Perfect Condition", color: "border-green-500 bg-green-50 text-green-700", description: "No damage, exactly as received" },
  { value: "minor_wear", label: "Minor Wear", color: "border-amber-500 bg-amber-50 text-amber-700", description: "Small scuffs, normal use wear" },
  { value: "damaged", label: "Damaged", color: "border-red-500 bg-red-50 text-red-700", description: "Visible damage beyond normal use" },
  { value: "missing", label: "Parts Missing", color: "border-destructive bg-destructive/10 text-destructive", description: "Accessories or parts not returned" },
]

interface RentalReturnFlowProps {
  orderId: string
  listingTitle: string
  depositAmount: number
  isSeller: boolean
  onComplete?: () => void
}

type Step = "condition" | "photos" | "notes" | "confirm" | "done"

export function RentalReturnFlow({ orderId, listingTitle, depositAmount, isSeller, onComplete }: RentalReturnFlowProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>("condition")
  const [condition, setCondition] = useState<ReturnCondition | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !auth.currentUser) return
    setUploading(true)
    try {
      const file = e.target.files[0]
      const path = `returns/${orderId}/${Date.now()}_${file.name}`
      const snap = await uploadBytes(ref(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      setPhotos(prev => [...prev, url])
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!condition) return
    setSubmitting(true)
    try {
      const needsDeduction = condition === "damaged" || condition === "missing"

      await AdminService.updateDoc("orders", orderId, {
        returnCondition: condition,
        returnPhotos: photos,
        returnNotes: notes,
        returnSubmittedAt: serverTimestamp(),
        returnSubmittedBy: isSeller ? "seller" : "buyer",
        status: needsDeduction ? "return_disputed" : "return_confirmed",
        depositStatus: needsDeduction ? "held" : "refunded",
        updatedAt: serverTimestamp(),
      })

      // Create return inspection record
      await AdminService.addDoc("returnInspections", {
        orderId,
        condition,
        photos,
        notes,
        submittedBy: isSeller ? "seller" : "buyer",
        requiresAdminReview: needsDeduction,
        createdAt: serverTimestamp(),
      })

      setStep("done")
      onComplete?.()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const steps: Step[] = ["condition", "photos", "notes", "confirm"]
  const stepIndex = steps.indexOf(step)

  if (step === "done") {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6 text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
          <h3 className="font-semibold text-green-800">Return Report Submitted</h3>
          <p className="text-sm text-green-700">
            {condition === "perfect" || condition === "minor_wear"
              ? "The deposit refund will be processed within 24 hours."
              : "Our team will review the damage report and contact both parties within 48 hours."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            Return Inspection — {listingTitle}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Step {stepIndex + 1} of {steps.length}
          </Badge>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1 pt-2">
          {steps.map((s, i) => (
            <div key={s} className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= stepIndex ? "bg-primary" : "bg-muted"
            )} />
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Step 1: Condition */}
        {step === "condition" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isSeller ? "What condition was the item returned in?" : "What condition is the item you're returning?"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CONDITION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCondition(opt.value)}
                  className={cn(
                    "p-3 rounded-lg border-2 text-left transition-all",
                    condition === opt.value ? opt.color : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="font-medium text-xs">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
            <Button className="w-full" disabled={!condition} onClick={() => setStep("photos")}>
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Photos */}
        {step === "photos" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload photos of the item's current condition. Required for damage claims.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                  <img src={url} alt={`Return photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <label className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary bg-muted/20">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground mt-1">Add Photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("condition")}>Back</Button>
              <Button className="flex-1" onClick={() => setStep("notes")} disabled={condition !== "perfect" && photos.length === 0}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Notes */}
        {step === "notes" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Add any notes about the return (optional but recommended for disputes).</p>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Screen has a small scratch on the bottom-right corner. Charger returned. All accessories intact."
              rows={4}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("photos")}>Back</Button>
              <Button className="flex-1" onClick={() => setStep("confirm")}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === "confirm" && (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Condition</span>
                <Badge className={CONDITION_OPTIONS.find(o => o.value === condition)?.color}>
                  {CONDITION_OPTIONS.find(o => o.value === condition)?.label}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Photos</span>
                <span>{photos.length} uploaded</span>
              </div>
            </div>

            {(condition === "damaged" || condition === "missing") && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-700">
                  This will flag the return for admin review. The deposit will be held until resolved (up to 48hrs).
                </AlertDescription>
              </Alert>
            )}

            {(condition === "perfect" || condition === "minor_wear") && (
              <Alert className="border-green-200 bg-green-50">
                <Shield className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-xs text-green-700">
                  Full deposit of ₦{depositAmount?.toLocaleString()} will be refunded to buyer within 24hrs.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("notes")}>Back</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</> : "Submit Return Report"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
