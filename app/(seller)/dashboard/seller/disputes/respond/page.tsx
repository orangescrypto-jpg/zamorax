"use client"

// app/(seller)/dashboard/seller/disputes/respond/page.tsx
// Allows the seller to submit a written response and upload counter-evidence
// for a dispute filed against their order.
// Accessible from seller order detail page when order.status === "disputed".

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { StorageService, AdminService } from "@/src/services"
import { DisputesService } from "@/src/services/disputes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ShieldAlert, Upload, Loader2, X, CheckCircle } from "lucide-react"

export default function SellerDisputeRespondPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const disputeId    = searchParams.get("disputeId") || ""
  const orderId      = searchParams.get("orderId")   || ""
  const { user }     = useAuth()
  const { toast }    = useToast()

  const [response, setResponse]     = useState("")
  const [files, setFiles]           = useState<File[]>([])
  const [previews, setPreviews]     = useState<string[]>([])
  const [loading, setLoading]       = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).slice(0, 4)
    setFiles(selected)
    setPreviews(selected.map(f => URL.createObjectURL(f)))
  }

  const removeFile = (i: number) => {
    setFiles(prev  => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async () => {
    if (!disputeId)                   { toast({ title: "Dispute ID missing", variant: "destructive" }); return }
    if (response.trim().length < 20)  { toast({ title: "Please write a response (min 20 chars)", variant: "destructive" }); return }
    if (!user?.uid) return

    setLoading(true)
    try {
      // Upload seller counter-evidence images
      const evidenceUrls: string[] = []
      for (const file of files) {
        const { url } = await StorageService.uploadFile(
          file,
          `disputes/${disputeId}/seller/${Date.now()}_${file.name}`,
        )
        evidenceUrls.push(url)
      }

      // Submit response via DisputesService (→ /api/disputes/respond)
      await DisputesService.respondToDispute(
        disputeId,
        user.uid,
        response.trim(),
        evidenceUrls,
      )

      setSubmitted(true)
      toast({
        title:       "Response Submitted ✅",
        description: "The admin team will review your response alongside the buyer's claim.",
        variant:     "success",
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (!disputeId) {
    return (
      <div className="container max-w-lg py-12 text-center space-y-4">
        <ShieldAlert className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-xl font-heading font-bold">Dispute ID Missing</h2>
        <p className="text-sm text-muted-foreground">
          Navigate here from your order detail page.
        </p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  if (submitted) return (
    <div className="container max-w-md py-16 text-center space-y-4">
      <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="text-2xl font-heading font-bold">Response Submitted</h1>
      <p className="text-muted-foreground text-sm">
        The admin team will review your response alongside the buyer's claim.
        You'll be notified once a decision is made.
      </p>
      <Button onClick={() => router.push("/dashboard/seller/orders")} className="w-full">
        Back to Orders
      </Button>
    </div>
  )

  return (
    <div className="container max-w-lg py-8 space-y-6 pb-24">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-amber-500" /> Respond to Dispute
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Order #{orderId.slice(-6).toUpperCase()} — Your response will be reviewed by our admin team.
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-700 text-sm">
          Be clear and factual. Upload any evidence that supports your case — delivery photos,
          chat screenshots, packing videos, etc.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="text-base">Your Response</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="response">
              Explain your side <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="response"
              placeholder="e.g., I shipped the item on [date] via [carrier]. Here is the tracking number: ... The item was in perfect condition when packed..."
              rows={6}
              value={response}
              onChange={e => setResponse(e.target.value)}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">{response.length}/2000</p>
          </div>

          <div className="space-y-2">
            <Label>Counter-Evidence Photos (optional, max 4)</Label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-muted/30 transition-colors text-muted-foreground text-sm">
              <Upload className="h-6 w-6" />
              <span>Tap to upload photos</span>
              <span className="text-xs">Delivery confirmation, packing photos, screenshots</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
            {previews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={src} alt="" className="object-cover w-full h-full" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full h-12 text-base"
        onClick={handleSubmit}
        disabled={loading || response.trim().length < 20}
      >
        {loading
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
          : <><ShieldAlert className="h-4 w-4 mr-2" /> Submit Response</>}
      </Button>
    </div>
  )
}
