"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { DisputeEvidenceViewer } from "./DisputeEvidenceViewer"
import { DisputesService } from "@/src/services"
import { formatPrice } from "@/lib/utils"
import { FileText, Eye, CheckCircle, XCircle, Scale } from "lucide-react"

type Dispute = {
  id: string
  orderId?: string
  buyerId?: string
  sellerId?: string
  reason?: string
  status?: string
  evidence?: any[]
  resolution?: string
  createdAt?: any
  [key: string]: any
}

export function DisputeCard({ dispute }: { dispute: Dispute }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [addToLedger, setAddToLedger] = useState(true)

  const handleResolve = async (resolution: "refunded" | "released" | "split") => {
    if (!user?.uid) return
    setLoading(true)
    try {
      await DisputesService.resolveDispute(dispute.id, dispute.orderId ?? "", resolution, user.uid, addToLedger)
      toast({ title: "Dispute Resolved", description: `Resolution: ${resolution}. Order & insurance pool updated.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base">{dispute.reason || "No Reason Provided"}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Order: {dispute.orderId?.slice(-6).toUpperCase()} • Category: {dispute.categorySlug?.replace("-", " ")}</p>
        </div>
        <Badge variant={dispute.status === "resolved" ? "success" : dispute.status === "investigating" ? "warning" : "destructive"}>
          {dispute.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{dispute.description}</p>
        
        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1"><Eye className="h-4 w-4" /> View Evidence</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Dispute Evidence & Context</DialogTitle></DialogHeader>
              <DisputeEvidenceViewer dispute={dispute} />
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2 ml-auto">
            <Checkbox checked={addToLedger} onCheckedChange={v => setAddToLedger(v as boolean)} id="ledger-check" />
            <label htmlFor="ledger-check" className="text-xs text-muted-foreground cursor-pointer">Add to Public Ledger</label>
          </div>
        </div>

        {dispute.status !== "resolved" && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button onClick={() => handleResolve("refunded")} disabled={loading} variant="destructive" size="sm" className="gap-1">
              <XCircle className="h-3.5 w-3.5" /> Refund Buyer
            </Button>
            <Button onClick={() => handleResolve("released")} disabled={loading} variant="secondary" size="sm" className="gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Release to Seller
            </Button>
            <Button onClick={() => handleResolve("split")} disabled={loading} variant="outline" size="sm" className="gap-1">
              <Scale className="h-3.5 w-3.5" /> Split Payout
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
