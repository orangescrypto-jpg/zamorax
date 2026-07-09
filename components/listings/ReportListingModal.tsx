"use client"

import { AdminService , serverTimestamp } from "@/src/services"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter, usePathname } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Flag, Loader2 } from "lucide-react"
import { addDoc } from "@/src/services"

const REPORT_REASONS = [
  { value: "counterfeit",      label: "Counterfeit / fake item" },
  { value: "stolen",           label: "Stolen goods" },
  { value: "prohibited",       label: "Prohibited / illegal item" },
  { value: "misleading",       label: "Misleading description or photos" },
  { value: "wrong_price",      label: "Pricing scam" },
  { value: "already_sold",     label: "Item already sold elsewhere" },
  { value: "spam",             label: "Spam / duplicate listing" },
  { value: "other",            label: "Other" },
]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  listingId: string
  listingTitle: string
  sellerId: string
}

export function ReportListingModal({ open, onOpenChange, listingId, listingTitle, sellerId }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!user?.uid) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return }
    if (!reason) { toast({ title: "Select a reason", variant: "destructive" }); return }

    setLoading(true)
    try {
      await AdminService.addDoc("listingReports", {
        listingId,
        listingTitle,
        sellerId,
        reporterId: user.uid,
        reporterEmail: user.email,
        reason,
        details: details.trim(),
        status: "pending",          // pending | reviewed | dismissed
        createdAt: serverTimestamp(),
      })
      toast({ title: "Report submitted", description: "Our moderation team will review this listing.", variant: "success" })
      onOpenChange(false)
      setReason("")
      setDetails("")
    } catch {
      toast({ title: "Could not submit report", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Flag className="h-4 w-4" /> Report Listing
          </DialogTitle>
          <DialogDescription className="truncate text-xs">
            "{listingTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Reason <span className="text-red-500">*</span></Label>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
              {REPORT_REASONS.map(r => (
                <div key={r.value} className="flex items-center gap-2.5">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="text-sm font-normal cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Additional details <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              placeholder="Describe what makes this listing suspicious..."
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">{details.length}/500</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleSubmit}
            disabled={!reason || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Flag className="h-3.5 w-3.5 mr-1.5" /> Submit Report</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
