"use client"

import { AdminService, serverTimestamp, increment } from "@/src/services"

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
import { Wallet, CheckCircle, XCircle, Loader2, Building2 } from "lucide-react"

interface AgentWithdrawal {
  id: string
  status: string
  agentId: string
  agentName?: string
  agentEmail?: string
  amount?: number
  bankName?: string
  accountNumber?: string
  accountName?: string
  rejectionReason?: string
  transferReference?: string
  [key: string]: unknown
}

// Refunds the agent's wallet — used when a withdrawal is rejected after the
// balance was already deducted at request time.
async function refundAgentWallet(agentId: string, amountKobo: number, withdrawalId: string) {
  await AdminService.updateDoc("agent_wallets", agentId, {
    balance: increment(amountKobo),
    updatedAt: serverTimestamp(),
  })
  await AdminService.addDoc("wallet_transactions", {
    user_id: agentId,
    type: "refund",
    amount: amountKobo,
    description: `Withdrawal rejected — ₦${(amountKobo / 100).toLocaleString("en-NG")} refunded to wallet`,
    reference: withdrawalId,
    status: "completed",
  })
}

export default function AdminAgentWithdrawalsPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [withdrawals, setWithdrawals] = useState<AgentWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payingWithdrawal, setPayingWithdrawal] = useState<AgentWithdrawal | null>(null)
  const [transferReference, setTransferReference] = useState("")

  const loadWithdrawals = async () => {
    setLoading(true)
    try {
      const docs = await AdminService.getCollection("agent_withdrawals", [
        { field: "createdAt", dir: "desc" },
      ])
      setWithdrawals((docs ?? []) as unknown as AgentWithdrawal[])
    } catch (e: any) {
      toast({ title: "Failed to load withdrawals", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWithdrawals() }, [])

  const pending = withdrawals.filter(w => w.status === "pending")
  const approved = withdrawals.filter(w => w.status === "approved")
  const completed = withdrawals.filter(w => w.status === "completed")
  const rejected = withdrawals.filter(w => w.status === "rejected")

  const handleApprove = async (w: AgentWithdrawal) => {
    if (!user?.uid) return
    setProcessing(w.id)
    try {
      await AdminService.updateDoc("agent_withdrawals", w.id, {
        status: "approved",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
      })
      toast({ title: "Withdrawal Approved ✅", description: `${formatPrice(w.amount ?? 0)} approved for ${w.agentName}.`, variant: "success" })
      await loadWithdrawals()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setProcessing(null)
    }
  }

  const openPayDialog = (w: AgentWithdrawal) => {
    setPayingWithdrawal(w)
    setTransferReference("")
    setPayDialogOpen(true)
  }

  const handleMarkPaid = async () => {
    if (!payingWithdrawal || !user?.uid || !transferReference.trim()) return
    setProcessing(payingWithdrawal.id)
    try {
      await AdminService.updateDoc("agent_withdrawals", payingWithdrawal.id, {
        status: "completed",
        transferReference: transferReference.trim(),
        paidBy: user.uid,
        paidAt: serverTimestamp(),
      })
      toast({ title: "Marked as Paid ✅", description: `${formatPrice(payingWithdrawal.amount ?? 0)} paid to ${payingWithdrawal.agentName}.`, variant: "success" })
      setPayDialogOpen(false)
      await loadWithdrawals()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setProcessing(null)
    }
  }

  const openRejectDialog = (id: string) => {
    setRejectingId(id)
    setRejectReason("")
    setRejectDialogOpen(true)
  }

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return
    const w = withdrawals.find(w => w.id === rejectingId)
    if (!w) return
    setProcessing(rejectingId)
    try {
      await AdminService.updateDoc("agent_withdrawals", rejectingId, {
        status: "rejected",
        rejectionReason: rejectReason.trim(),
      })
      await refundAgentWallet(w.agentId, Number(w.amount ?? 0), rejectingId)
      toast({ title: "Withdrawal Rejected", description: "The agent's balance has been refunded.", variant: "success" })
      setRejectDialogOpen(false)
      await loadWithdrawals()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setProcessing(null)
    }
  }

  const renderCard = (w: AgentWithdrawal) => (
    <Card key={w.id}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">{w.agentName ?? "Agent"}</p>
            <p className="text-xs text-muted-foreground">{w.agentEmail}</p>
          </div>
          <Badge
            variant={
              w.status === "completed" ? "default"
              : w.status === "approved" ? "secondary"
              : w.status === "rejected" ? "destructive"
              : "outline"
            }
          >
            {w.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="font-bold text-primary">{formatPrice(w.amount ?? 0)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>{w.bankName} · {w.accountNumber} · {w.accountName}</span>
        </div>

        {w.status === "rejected" && w.rejectionReason && (
          <p className="text-xs text-red-500">Reason: {w.rejectionReason}</p>
        )}
        {w.status === "completed" && w.transferReference && (
          <p className="text-xs text-muted-foreground">Ref: {w.transferReference}</p>
        )}

        {w.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" disabled={processing === w.id} onClick={() => handleApprove(w)}>
              {processing === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Approve
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" disabled={processing === w.id} onClick={() => openRejectDialog(w.id)}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        )}

        {w.status === "approved" && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="flex-1" disabled={processing === w.id} onClick={() => openPayDialog(w)}>
              Mark as Paid
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" disabled={processing === w.id} onClick={() => openRejectDialog(w.id)}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <main className="container max-w-2xl py-6 space-y-5">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Agent Withdrawals
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Approve, pay, or reject referral-agent payout requests.</p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="completed">Paid ({completed.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="space-y-3 mt-4">
            {pending.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No pending requests.</p> : pending.map(renderCard)}
          </TabsContent>
          <TabsContent value="approved" className="space-y-3 mt-4">
            {approved.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No approved requests awaiting payment.</p> : approved.map(renderCard)}
          </TabsContent>
          <TabsContent value="completed" className="space-y-3 mt-4">
            {completed.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No paid withdrawals yet.</p> : completed.map(renderCard)}
          </TabsContent>
          <TabsContent value="rejected" className="space-y-3 mt-4">
            {rejected.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No rejected withdrawals.</p> : rejected.map(renderCard)}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>The agent's balance will be refunded automatically. Provide a reason for the record.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectReason.trim() || !!processing} onClick={handleReject}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Enter the bank transfer reference after manually paying {payingWithdrawal?.agentName} via {payingWithdrawal?.bankName}.
            </DialogDescription>
          </DialogHeader>
          <Input placeholder="Transfer reference / receipt no." value={transferReference} onChange={e => setTransferReference(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button disabled={!transferReference.trim() || !!processing} onClick={handleMarkPaid}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
