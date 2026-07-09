"use client"

import {AdminService, serverTimestamp} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { formatPrice } from "@/lib/utils"
import { Wallet, CheckCircle, XCircle, Loader2, Copy, Building2, Zap, Upload } from "lucide-react"
import { getPlatformSettings } from "@/src/services/platformSettings"

interface Withdrawal {
  id: string
  status: string
  sellerId: string
  sellerName?: string
  sellerEmail?: string
  amount?: number
  fee?: number
  bankName?: string
  accountNumber?: string
  accountName?: string
  bankCode?: string
  rejectionReason?: string
  transferReference?: string
  proofUrl?: string
  payoutMethod?: "manual" | "paystack"
  [key: string]: unknown
}

// The seller's "Transaction History" table (dashboard/seller/earnings)
// reads withdrawal status straight from the original "payout" row in
// wallet_transactions — NOT from the withdrawals table. That payout row
// is created once, at request time, with status "pending" (see
// /api/seller/withdraw), and nothing ever updated it afterward: every
// write to wallet_transactions across the whole codebase is an addDoc
// (a new row), never an updateDoc on the existing one. So a withdrawal
// could be fully approved/paid in the withdrawals table while its payout
// row — the one sellers actually see — stayed stuck on "pending" forever.
// This finds that original row by reference === withdrawalId (set at
// creation time) and syncs its status so the seller's table reflects
// reality once an admin (or the Paystack webhook) completes/rejects it.
async function syncWithdrawalTransactionStatus(withdrawalId: string, status: string) {
  try {
    const all = await AdminService.getCollection("wallet_transactions") as Record<string, unknown>[]
    const payoutRow = all.find(t => t.type === "payout" && String(t.reference ?? "") === withdrawalId)
    if (payoutRow) {
      await AdminService.updateDoc("wallet_transactions", String(payoutRow.id), { status })
    }
  } catch {
    // Best-effort — the withdrawals table remains the source of truth
    // even if this sync fails, so we don't want it to block the actual
    // approve/reject/pay action from completing.
  }
}

// Refunds the seller's wallet — used when a withdrawal is rejected after the
// amount was already deducted at request time (see /api/seller/withdraw).
// Without this, a rejected withdrawal permanently loses the seller's money.
async function refundSellerWallet(sellerId: string, amountKobo: number, withdrawalId: string) {
  const wallet = await AdminService.getDoc("seller_wallets", sellerId) as Record<string, unknown> | null
  const currentBalance = Number(wallet?.balance ?? 0)
  await AdminService.setDoc("seller_wallets", sellerId, {
    balance: currentBalance + amountKobo,
    updated_at: new Date().toISOString(),
  }, { merge: true })
  await AdminService.addDoc("wallet_transactions", {
    user_id: sellerId,
    type: "refund",
    amount: amountKobo,
    description: `Withdrawal rejected — ₦${(amountKobo / 100).toLocaleString("en-NG")} refunded to wallet`,
    reference: withdrawalId,
    status: "completed",
  })
  await syncWithdrawalTransactionStatus(withdrawalId, "rejected")
}

export default function AdminWithdrawalsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [payoutMethod, setPayoutMethod] = useState<"manual" | "paystack">("manual")

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  // Mark-paid dialog (manual mode) — requires proof before confirming
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payingWithdrawal, setPayingWithdrawal] = useState<Withdrawal | null>(null)
  const [transferReference, setTransferReference] = useState("")
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)

  useEffect(() => {
    getPlatformSettings().then(s => setPayoutMethod(s.payoutMethod ?? "manual"))
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const rows = await AdminService.getCollection("withdrawals")
        if (!active) return
        // FIX: the real withdrawals column is user_id (rowToDoc surfaces it
        // as userId, not sellerId) — normalize here so every reference to
        // w.sellerId throughout this page keeps working.
        const normalized = (rows as Record<string, unknown>[]).map(r => ({
          ...r,
          sellerId: String(r.sellerId ?? r.userId ?? r.user_id ?? ""),
        }))
        setWithdrawals(normalized as unknown as Withdrawal[])
      } catch { /* keep previous list on transient errors */ }
      finally { if (active) setLoading(false) }
    }
    load()
    const interval = setInterval(load, 15_000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const handleApprove = async (w: Withdrawal) => {
    if (!user?.uid) return
    setProcessing(w.id)
    try {
      await AdminService.updateDoc("withdrawals", w.id, {
        status: "approved",
        payoutMethod: "manual",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp() })
      await syncWithdrawalTransactionStatus(w.id, "approved")
      toast({ title: "Withdrawal Approved ✅", description: `${formatPrice(w.amount ?? 0)} approved for ${w.sellerName}.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  // Paystack mode: approving triggers an immediate real bank transfer —
  // no separate "mark as paid" step needed since Paystack confirms it.
  const handleApprovePaystack = async (w: Withdrawal) => {
    if (!user?.uid) return
    setProcessing(w.id)
    try {
      const res = await fetch("/api/payment/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKobo: w.amount,
          accountName: w.accountName,
          accountNumber: w.accountNumber,
          bankCode: w.bankCode,
          reference: `WD-${w.id}`,
          reason: `Zamorax withdrawal for ${w.sellerName}`,
        }),
      })
      // FIX: same guard as /api/seller/withdraw's client — res.json() was
      // called unconditionally, so a crashed/empty response threw
      // "Unexpected end of JSON input" and hid the real error.
      const raw = await res.text()
      let data: any = {}
      try { data = raw ? JSON.parse(raw) : {} } catch { /* fall through to generic error below */ }

      // FIX: a transfer requiring OTP approval is NOT complete — the route
      // now returns requiresOtp:true for this case instead of a false
      // success. Previously any non-error response was treated as "paid",
      // which would have marked this withdrawal completed and emailed the
      // seller before the money had actually moved.
      if (data.requiresOtp) {
        toast({
          title: "OTP approval required",
          description: "This transfer needs OTP approval in your Paystack dashboard before it's complete. It has NOT been marked as paid — approve it there, then use \"Mark as Paid\" manually with the transfer reference.",
          variant: "destructive",
        })
        return
      }
      if (!data.success) {
        // Common causes: insufficient Paystack balance, bad bank code, KYC
        // not yet approved for live transfers. Surface it, don't silently fail.
        toast({ title: "Transfer failed", description: data.error || "Could not reach Paystack.", variant: "destructive" })
        return
      }

      // FIX: Paystack can accept a transfer (success:true) but return
      // transferStatus "pending" — the receiving bank hasn't confirmed it
      // yet, and it can still fail or reverse afterward. This used to be
      // treated identically to "success" and marked the withdrawal
      // "completed" immediately, with no way to ever correct it if the
      // transfer later failed. Now: "success" completes it here as before;
      // "pending" moves it to "processing" and leaves final confirmation to
      // POST /api/webhooks/paystack, which listens for transfer.success /
      // transfer.failed / transfer.reversed and reconciles the real outcome.
      const isConfirmedSuccess = data.transferStatus === "success"
      await AdminService.updateDoc("withdrawals", w.id, {
        status: isConfirmedSuccess ? "completed" : "processing",
        payoutMethod: "paystack",
        transferReference: data.transferCode,
        approvedBy: user.uid,
        paidBy: user.uid,
        paidAt: isConfirmedSuccess ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      })
      await syncWithdrawalTransactionStatus(w.id, isConfirmedSuccess ? "completed" : "processing")
      // FIX: seller previously had no way to see the transfer reference or
      // proof of payment — only an in-app row with no detail. Notify by
      // email, which can carry both. Only send the "paid" email once the
      // transfer is actually confirmed — a "processing" one will get its
      // email from the webhook when transfer.success eventually fires.
      if (isConfirmedSuccess) {
        fetch("/api/payment/notify-withdrawal-paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawalId: w.id }),
        }).catch(() => { /* non-fatal — seller still sees it in Payout History */ })
      }
      toast({
        title: data.alreadyProcessed
          ? "Already sent ✓"
          : isConfirmedSuccess ? "Transfer sent ⚡" : "Transfer processing ⏳",
        description: data.alreadyProcessed
          ? `This transfer was already processed by Paystack — no duplicate was sent. ₦${((w.amount||0)/100).toLocaleString("en-NG")} to ${w.sellerName}.`
          : isConfirmedSuccess
            ? `₦${((w.amount||0)/100).toLocaleString("en-NG")} sent to ${w.sellerName} via Paystack.`
            : `Paystack accepted the transfer but hasn't confirmed it yet. This will finalize automatically once Paystack sends confirmation.`,
        variant: "success",
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const openPayDialog = (w: Withdrawal) => {
    setPayingWithdrawal(w)
    setTransferReference("")
    setProofFile(null)
    setPayDialogOpen(true)
  }

  // Manual mode: admin must attach a transfer reference + proof screenshot
  // before a withdrawal can be marked paid — this is the evidence needed
  // if a seller later disputes "I never got paid."
  const handleConfirmManualPaid = async () => {
    if (!user?.uid || !payingWithdrawal || !transferReference.trim() || !proofFile) return
    setUploadingProof(true)
    try {
      const formData = new FormData()
      formData.append("file", proofFile)
      formData.append("path", `payout-proofs/${payingWithdrawal.id}/${Date.now()}-${proofFile.name}`)
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error || "Proof upload failed")

      await AdminService.updateDoc("withdrawals", payingWithdrawal.id, {
        status: "completed",
        payoutMethod: "manual",
        transferReference: transferReference.trim(),
        proofUrl: uploadData.url,
        paidBy: user.uid,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await syncWithdrawalTransactionStatus(payingWithdrawal.id, "completed")
      // FIX: same as the Paystack path — email the seller with the
      // reference and proof link admin just attached.
      fetch("/api/payment/notify-withdrawal-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId: payingWithdrawal.id }),
      }).catch(() => { /* non-fatal — seller still sees it in Payout History */ })
      toast({ title: "Marked as Paid 💸", description: `Transfer to ${payingWithdrawal.sellerName} confirmed with proof attached.`, variant: "success" })
      setPayDialogOpen(false)
      setPayingWithdrawal(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setUploadingProof(false) }
  }

  const handleRejectSubmit = async () => {
    if (!user?.uid || !rejectingId || !rejectReason.trim()) return
    setProcessing(rejectingId)
    try {
      const w = withdrawals.find(x => x.id === rejectingId)
      await AdminService.updateDoc("withdrawals", rejectingId, {
        status: "rejected",
        rejectedBy: user.uid,
        rejectedAt: serverTimestamp(),
        rejectionReason: rejectReason.trim(),
        updatedAt: serverTimestamp() })

      // FIX: the amount was deducted from the seller's wallet the moment
      // they requested withdrawal (see /api/seller/withdraw). Rejecting
      // without refunding permanently loses the seller's money.
      if (w) {
        await refundSellerWallet(w.sellerId, w.amount || 0, w.id)
        await AdminService.addDoc("notifications", {
          user_id: w.sellerId,
          type: "system",
          title: "Withdrawal Rejected — Refunded",
          body: `Your withdrawal of ₦${((w.amount||0)/100).toLocaleString("en-NG")} was rejected and refunded to your wallet. Reason: ${rejectReason.trim()}`,
          link: "/dashboard/seller/wallet",
          is_read: false,
        })
      }

      setRejectDialogOpen(false)
      setRejectReason("")
      setRejectingId(null)
      toast({ title: "Withdrawal Rejected", description: "Seller has been refunded and notified.", variant: "destructive" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: `${label} copied!` })
  }

  const pending = withdrawals.filter(w => w.status === "pending")
  // "processing" = Paystack accepted the transfer but hasn't confirmed it
  // yet (transferStatus "pending" from the transfer API) — grouped with
  // "approved" since both mean "approved, payout in flight, not yet paid".
  // Without this, a processing withdrawal would match none of the four
  // tabs below and simply disappear from the admin UI until the webhook
  // resolves it to completed/failed.
  const approved = withdrawals.filter(w => w.status === "approved" || w.status === "processing")
  const completed = withdrawals.filter(w => w.status === "completed")
  const rejected = withdrawals.filter(w => w.status === "rejected")

  const totalPending = pending.reduce((s, w) => s + (w.amount || 0), 0)
  const totalPaid = completed.reduce((s, w) => s + (w.amount || 0), 0)

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="container py-8 space-y-6">
      <div className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${payoutMethod === "paystack" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
        {payoutMethod === "paystack" ? <Zap className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
        Payout mode: {payoutMethod === "paystack" ? "Paystack (automatic transfer on approval)" : "Manual (admin sends transfer by hand)"}
        <span className="text-xs opacity-70 ml-1">— change in Admin Settings → Payments</span>
      </div>

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
                payoutMethod={payoutMethod}
                processing={processing === w.id}
                onApprove={() => handleApprove(w)}
                onMarkPaid={() => openPayDialog(w)}
                onApprovePaystack={() => handleApprovePaystack(w)}
                onReject={() => { setRejectingId(w.id); setRejectDialogOpen(true) }}
                onCopy={copyToClipboard}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Mark Paid Dialog (manual mode) — proof required */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => { if (!uploadingProof) setPayDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Payment Sent</DialogTitle>
            <DialogDescription>
              Attach a transfer reference and proof of payment before marking this as paid. This protects both you and {payingWithdrawal?.sellerName} if the transfer is later disputed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Transfer reference / session ID</label>
              <Input
                placeholder="e.g. bank app reference number"
                value={transferReference}
                onChange={e => setTransferReference(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Proof of payment (screenshot/receipt)</label>
              <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-3 text-sm cursor-pointer hover:bg-muted/40">
                <Upload className="h-4 w-4 text-muted-foreground" />
                {proofFile ? proofFile.name : "Choose image or PDF"}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => setProofFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)} disabled={uploadingProof}>Cancel</Button>
            <Button
              onClick={handleConfirmManualPaid}
              disabled={!transferReference.trim() || !proofFile || uploadingProof}
              className="bg-primary text-white"
            >
              {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  w, tab, payoutMethod, processing, onApprove, onMarkPaid, onApprovePaystack, onReject, onCopy
}: {
  w: Withdrawal
  tab: string
  payoutMethod: "manual" | "paystack"
  processing: boolean
  onApprove: () => void
  onMarkPaid: () => void
  onApprovePaystack: () => void
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
              <button onClick={() => onCopy(w.accountNumber!, "Account number")} className="text-muted-foreground hover:text-primary ml-auto">
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
            Rejection reason: {w.rejectionReason} — amount was refunded to seller's wallet.
          </p>
        )}

        {tab === "completed" && (w.transferReference || w.proofUrl) && (
          <div className="mt-2 text-xs bg-emerald-50 text-emerald-800 rounded px-3 py-2 flex flex-col gap-1">
            {w.transferReference && <span>Reference: <span className="font-mono">{w.transferReference}</span></span>}
            {w.proofUrl && <a href={w.proofUrl} target="_blank" rel="noreferrer" className="underline">View proof of payment</a>}
          </div>
        )}

        {/* Actions */}
        {tab === "pending" && (
          <div className="flex flex-col gap-2 mt-4">
            <div className="flex gap-2">
              {payoutMethod === "paystack" ? (
                <Button onClick={onApprovePaystack} disabled={processing} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4 mr-1" /> Approve & Send via Paystack</>}
                </Button>
              ) : (
                <Button onClick={onApprove} disabled={processing} className="flex-1 bg-accent hover:bg-accent/90 text-white">
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>}
                </Button>
              )}
              <Button variant="destructive" onClick={onReject} disabled={processing}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
            {/* Per-withdrawal fallback — the global "Automatic payout via
                Paystack" toggle sets the default/primary action above, but
                doesn't have to be the only option: Paystack balance can run
                low, KYC can lapse, or a specific seller may need manual
                handling. Without this, turning Paystack mode on removed
                manual approval entirely with no way back for a single
                withdrawal. */}
            <Button
              onClick={payoutMethod === "paystack" ? onApprove : onApprovePaystack}
              disabled={processing}
              variant="outline"
              size="sm"
              className="text-xs text-muted-foreground"
            >
              {payoutMethod === "paystack"
                ? <><Building2 className="h-3.5 w-3.5 mr-1" /> Approve manually instead (skip Paystack)</>
                : <><Zap className="h-3.5 w-3.5 mr-1" /> Send via Paystack instead</>}
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
