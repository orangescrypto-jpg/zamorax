"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { AdminService } from "@/src/services"
import { DisputesService } from "@/src/services/disputes"
import { StorageService } from "@/src/services"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, ShieldAlert, Upload, Loader2, X } from "lucide-react"
import Link from "next/link"

const DISPUTE_REASONS = [
  "Item not received",
  "Item significantly different from description",
  "Item arrived damaged",
  "Wrong item sent",
  "Item is counterfeit / fake",
  "Seller unresponsive",
  "Seller asked to pay outside Zamorax",
  "Other",
]

export default function NewDisputePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("orderId") || ""
  const { user } = useAuth()
  const { toast } = useToast()

  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).slice(0, 4)
    setFiles(selected)
    setPreviews(selected.map(f => URL.createObjectURL(f)))
  }

  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async () => {
    if (!reason) { toast({ title: "Select a reason", variant: "destructive" }); return }
    if (description.trim().length < 20) { toast({ title: "Please describe the issue (min 20 characters)", variant: "destructive" }); return }
    if (!orderId) { toast({ title: "Order ID missing", variant: "destructive" }); return }
    if (!user?.uid) return

    setLoading(true)
    try {
      // Fetch order to get sellerId (required by DisputesService)
      const order = await AdminService.getDoc("orders", orderId)
      if (!order) throw new Error("Order not found")
      const sellerId = order.sellerId as string

      // Upload evidence via StorageService (not firebase/storage directly)
      const evidenceUrls: string[] = []
      for (const file of files) {
        const { url } = await StorageService.uploadFile(file, `disputes/${orderId}/${Date.now()}_${file.name}`)
        evidenceUrls.push(url)
      }

      // Open dispute via DisputesService (correct path — sets sellerId, autoResolved flag etc.)
      await DisputesService.openDispute({
        orderId,
        buyerId:   user.uid,
        sellerId,
        raisedBy:  "buyer",
        reason:    reason as any,
        description: description.trim(),
        evidence:  evidenceUrls,
      })

      // Notify seller
      await AdminService.addDoc("notifications", {
        userId:    sellerId,
        type:      "dispute_opened",
        title:     "Dispute Filed Against Your Order",
        body:      `A buyer has filed a dispute for order #${orderId.slice(-6).toUpperCase()}. Reason: ${reason}`,
        orderId,
        isRead:    false,
        createdAt: new Date(),
      })

      setSubmitted(true)
      toast({ title: "Dispute Filed ✅", description: "Admin will review within 48hrs.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div className="container max-w-md py-16 text-center space-y-4">
      <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
        <ShieldAlert className="h-10 w-10 text-amber-600" />
      </div>
      <h1 className="text-2xl font-heading font-bold">Dispute Filed</h1>
      <p className="text-muted-foreground text-sm">
        Your dispute has been submitted. Our team will review the evidence and contact both parties within <strong>48 hours</strong>.
        Funds remain locked in escrow until resolved.
      </p>
      <div className="flex flex-col gap-2 pt-2">
        <Button asChild className="bg-primary text-white hover:bg-primary/90">
          <Link href="/dashboard/buyer/orders">Back to Orders</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/chat">Message Seller</Link>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="container max-w-lg py-8 space-y-6 pb-24">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" /> File a Dispute
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Order #{orderId.slice(-6).toUpperCase()} — Funds stay locked until resolved.
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-700 text-sm">
          Before filing — have you tried messaging the seller? Most issues resolve faster through direct communication.{" "}
          <Link href="/chat" className="underline font-medium">Open Chat</Link>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="text-base">Dispute Details</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Reason <span className="text-red-500">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="What went wrong?" /></SelectTrigger>
              <SelectContent>
                {DISPUTE_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Describe the issue <span className="text-red-500">*</span></Label>
            <Textarea
              id="description"
              placeholder="Explain exactly what happened..."
              rows={5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/1000</p>
          </div>

          <div className="space-y-2">
            <Label>Evidence Photos (optional, max 4)</Label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:bg-muted/30 transition-colors text-muted-foreground text-sm">
              <Upload className="h-6 w-6" />
              <span>Tap to upload photos</span>
              <span className="text-xs">Screenshots, damaged item photos, delivery proof</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
            </label>
            {previews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                    <img src={src} alt="" className="object-cover w-full h-full" />
                    <button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertDescription className="text-amber-800 text-xs">
          <strong>False disputes may result in account suspension.</strong> Only file if you genuinely have an issue.
        </AlertDescription>
      </Alert>

      <Button
        className="w-full h-12 bg-red-600 hover:bg-red-700 text-white text-base"
        onClick={handleSubmit}
        disabled={loading || !reason || description.trim().length < 20}
      >
        {loading
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Filing Dispute...</>
          : <><ShieldAlert className="h-4 w-4 mr-2" /> Submit Dispute</>}
      </Button>
    </div>
  )
}
