"use client"

import {AdminService, query, orderBy, onSnapshot, serverTimestamp} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatPrice } from "@/lib/utils"
import { Wallet, CheckCircle, XCircle, Loader2, Copy, Building2 } from "lucide-react"
import {DocumentData} from "@/src/services"

type Withdrawal = DocumentData & { id: string }

export default function AdminWithdrawalsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    const q = AdminService._ref_("withdrawals", [orderBy("createdAt", "desc")])
    const unsub = onSnapshot(q, docs => {
      setWithdrawals(docs.map(d => ({ ...d })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const handleApprove = async (w: Withdrawal) => {
    if (!user?.uid) return
    setProcessing(w.id)
    try {
      await AdminService.updateDoc("withdrawals", w.id, {
        status: "approved",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp() })
      toast({ title: "Withdrawal Approved ✅", description: `${formatPrice(w.amount)} approved for ${w.sellerName}.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleMarkPaid = async (w: Withdrawal) => {
    if (!user?.uid) return
    setProcessing(w.id)
    try {
      await AdminService.updateDoc("withdrawals", w.id, {
        status: "completed",
        paidBy: user.uid,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp() })
      // Also update seller's balance record
      await AdminService.updateDoc("users", w.sellerId, {
        [`withdrawnAmount`]: (w.amount || 0),
        updatedAt: serverTimestamp() })
      toast({ title: "Marked as Paid 💸", description: `Transfer to ${w.sellerName} confirmed.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleRejectSubmit = async () => {
    if (!user?.uid || !rejectingId || !rejectReason.trim()) return
    setProcessing(rejectingId)
    try {
      await AdminService.updateDoc("withdrawals", rejectingId, {
        status: "rejected",
        rejectedBy: user.uid,
        rejectedAt: serverTimestamp(),
        rejectionReason: rejectReason.trim(),
        updatedAt: serverTimestamp() })
      setRejectDialogOpen(false)
      setRejectReason("")
      setRejectingId(null)
      toast({ title: "Withdrawal Rejected", description: "Seller will be notified.", variant: "destructive" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: `${label} copied!` })
  }

  const pending = withdrawals.filter(w => w.status === "pending")
  const approved = withdrawals.filter(w => w.status === "approved")
  const completed = withdrawals.filter(w => w.status === "completed")
  const rejected = withdrawals.filter(w => w.status === "rejected")

  const totalPending = pending.reduce((s, w) => s + (w.amount || 0), 0)
  const totalPaid = completed.reduce((s, w) => s + (w.amount || 0), 0)

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Withdrawal Management
          </h1>
          <p className="text-muted-foreground">Review, approve, and confirm seller bank transfers.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-amber-700">Pending</p>
            <p className="font-bold text-amber-800">{formatPrice(totalPending)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-emerald-700">Paid Out</p>
            <p className="font-bold text-emerald-800">{formatPrice(totalPaid)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="completed">Paid ({completed.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>

        {(["pending", "approved", "completed", "rejected"] as const).map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {(tab === "pending" ? pending : tab === "approved" ? approved : tab === "completed" ? completed : rejected).length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                No {tab} withdrawals.
              </div>
            )}
            {(tab === "pending" ? pending : tab === "approved" ? approved : tab === "completed" ? completed : rejected).map(w => (
              <WithdrawalRow
                key={w.id}
                w={w}
                tab={tab}
                processing={processing === w.id}
                onApprove={() => handleApprove(w)}
                onMarkPaid={() => handleMarkPaid(w)}
                onReject={() => { setRejectingId(w.id); setRejectDialogOpen(true) }}
                onCopy={copyToClipboard}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>Provide a reason so the seller understands what went wrong.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g., Invalid account number, account name mismatch, fraud review in progress..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectReason("") }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={!rejectReason.trim() || !!processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function WithdrawalRow({
  w, tab, processing, onApprove, onMarkPaid, onReject, onCopy
}: {
  w: Withdrawal
  tab: string
  processing: boolean
  onApprove: () => void
  onMarkPaid: () => void
  onReject: () => void
  onCopy: (text: string, label: string) => void
}) {
  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-blue-100 text-blue-800",
    completed: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800" }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Seller Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-lg shrink-0">
              {w.sellerName?.[0]?.toUpperCase() || "S"}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{w.sellerName || "Unknown Seller"}</p>
              <p className="text-xs text-muted-foreground truncate">{w.sellerEmail || "No Email"}</p>
            </div>
          </div>

          {/* Amount */}
          <div className="text-center">
            <p className="text-xl font-bold text-primary">{formatPrice(w.amount || 0)}</p>
            <p className="text-xs text-muted-foreground">Fee: {formatPrice(w.fee || 0)}</p>
          </div>

          {/* Status */}
          <Badge className={`${statusColors[w.status] || "bg-gray-100 text-gray-800"} capitalize shrink-0`}>
            {w.status}
          </Badge>
        </div>

        {/* Bank Details */}
        <div className="mt-4 bg-muted/40 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{w.bankName || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Acct:</span>
            <span className="font-mono font-medium">{w.accountNumber || "—"}</span>
            {w.accountNumber && (
              <button onClick={() => onCopy(w.accountNumber, "Account number")} className="text-muted-foreground hover:text-primary ml-auto">
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="text-muted-foreground truncate">
            {w.accountName || "—"}
          </div>
        </div>

        {w.rejectionReason && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-3 py-2">
            Rejection reason: {w.rejectionReason}
          </p>
        )}

        {/* Actions */}
        {tab === "pending" && (
          <div className="flex gap-2 mt-4">
            <Button onClick={onApprove} disabled={processing} className="flex-1 bg-accent hover:bg-accent/90 text-white">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>}
            </Button>
            <Button variant="destructive" onClick={onReject} disabled={processing}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        )}

        {tab === "approved" && (
          <div className="flex gap-2 mt-4">
            <Button onClick={onMarkPaid} disabled={processing} className="flex-1 bg-primary hover:bg-primary/90 text-white">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>💸 Mark as Paid (Transfer Sent)</>}
            </Button>
            <Button variant="destructive" onClick={onReject} disabled={processing}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
