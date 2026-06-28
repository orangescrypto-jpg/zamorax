"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DisputeEvidenceViewer } from "./DisputeEvidenceViewer"
import { DisputesService } from "@/src/services"
import type { Dispute } from "@/src/types"
import { Eye, CheckCircle, XCircle, Scale, Loader2, AlertTriangle } from "lucide-react"

export function DisputeCard({ dispute, onResolved }: { dispute: Dispute; onResolved?: () => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading]             = useState(false)
  const [addToLedger, setAddToLedger]     = useState(true)
  const [splitOpen, setSplitOpen]         = useState(false)
  const [refundPercent, setRefundPercent] = useState<number>(50)

  const handleResolve = async (resolution: "refunded" | "released" | "split", pct?: number) => {
    if (!user?.uid) return
    setLoading(true)
    try {
      await DisputesService.resolveDispute(
        dispute.id,
        dispute.orderId ?? "",
        resolution,
        user.uid,
        addToLedger,
        resolution === "split" ? (pct ?? refundPercent) : undefined,
      )
      toast({
        title:       "Dispute Resolved ✅",
        description: resolution === "split"
          ? `${pct ?? refundPercent}% refunded to buyer, remainder credited to seller wallet.`
          : resolution === "refunded"
          ? "Full refund logged. Seller wallet unchanged."
          : "Escrow released. Funds credited to seller wallet.",
        variant: "success",
      })
      setSplitOpen(false)
      onResolved?.()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const statusVariant =
    dispute.status === "resolved"      ? "success"     :
    dispute.status === "escalated"     ? "warning"     :
    dispute.status === "investigating" ? "secondary"   : "destructive"

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base">{dispute.reason || "No Reason Provided"}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Order: {dispute.orderId?.slice(-6).toUpperCase()}
            {(dispute as any).categorySlug && ` • ${(dispute as any).categorySlug.replace("-", " ")}`}
          </p>
        </div>
        <Badge variant={statusVariant}>{dispute.status}</Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{dispute.description}</p>

        {/* Moderator notes banner */}
        {dispute.moderatorNotes && (
          <div className="flex items-start gap-2 text-xs bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-purple-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Mod notes:</strong> {dispute.moderatorNotes}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Eye className="h-4 w-4" /> View Evidence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Dispute Evidence & Context</DialogTitle>
              </DialogHeader>
              <DisputeEvidenceViewer dispute={dispute} />
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2 ml-auto">
            <Checkbox
              checked={addToLedger}
              onCheckedChange={v => setAddToLedger(v as boolean)}
              id={`ledger-${dispute.id}`}
            />
            <label htmlFor={`ledger-${dispute.id}`} className="text-xs text-muted-foreground cursor-pointer">
              Add to Public Ledger
            </label>
          </div>
        </div>

        {dispute.status !== "resolved" && dispute.status !== "auto_resolved" && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {/* Refund Buyer */}
            <Button
              onClick={() => handleResolve("refunded")}
              disabled={loading}
              variant="destructive"
              size="sm"
              className="gap-1"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Refund Buyer
            </Button>

            {/* Release to Seller */}
            <Button
              onClick={() => handleResolve("released")}
              disabled={loading}
              variant="secondary"
              size="sm"
              className="gap-1"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Release to Seller
            </Button>

            {/* Split Payout — opens dialog to set percent */}
            <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1" disabled={loading}>
                  <Scale className="h-3.5 w-3.5" /> Split Payout
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Split Payout</DialogTitle>
                  <DialogDescription>
                    Set how much of the escrow is refunded to the buyer. The remainder goes to the seller's wallet.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="split-pct">Buyer refund %</Label>
                    <Input
                      id="split-pct"
                      type="number"
                      min={1}
                      max={99}
                      value={refundPercent}
                      onChange={e => setRefundPercent(Math.min(99, Math.max(1, Number(e.target.value))))}
                    />
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Buyer receives</span>
                      <span className="font-medium text-destructive">{refundPercent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Seller receives</span>
                      <span className="font-medium text-green-600">{100 - refundPercent}%</span>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSplitOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleResolve("split", refundPercent)}
                    disabled={loading}
                    className="bg-amber-500 hover:bg-amber-600 text-white gap-1"
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Scale className="h-4 w-4" />}
                    Confirm Split
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
