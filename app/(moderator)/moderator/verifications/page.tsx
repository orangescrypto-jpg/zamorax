"use client"

import {AdminService, query, orderBy, onSnapshot, serverTimestamp} from "@/src/services"
// app/(moderator)/moderator/verifications/page.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import {UsersService} from "@/src/services"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, CheckCircle, XCircle, Loader2, User, Eye, EyeOff, Phone, Mail } from "lucide-react"
import {DocumentData} from "@/src/services"

type VerifRequest = DocumentData & { id: string }

export default function ModeratorVerificationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests] = useState<VerifRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [showValue, setShowValue] = useState<Record<string, boolean>>({})
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    const q = AdminService._ref_("verificationRequests", [orderBy("createdAt", "desc")])
    return onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const handleApprove = async (req: VerifRequest) => {
    setProcessing(req.id)
    try {
      await AdminService.updateDoc("verificationRequests", req.id, {
        status: "approved",
        reviewedBy: user?.uid,
        reviewedAt: serverTimestamp() })
      if (req.type === "nin") {
        await UsersService.verifySellerNIN(req.userId, true)
      } else {
        await AdminService.updateDoc("users", req.userId, {
          bvnVerified: true,
          verificationLevel: "nin_bvn",
          bvnVerifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp() })
      }
      toast({ title: `${req.type?.toUpperCase()} Approved ✅`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectReason.trim()) return
    const req = requests.find(r => r.id === rejectingId)
    setProcessing(rejectingId)
    try {
      await AdminService.updateDoc("verificationRequests", rejectingId, {
        status: "rejected",
        rejectionReason: rejectReason.trim(),
        reviewedBy: user?.uid,
        reviewedAt: serverTimestamp() })
      if (req?.type === "nin") {
        await AdminService.updateDoc("users", req.userId, {
          verificationLevel: "phone",
          updatedAt: serverTimestamp() })
      }
      setRejectOpen(false); setRejectReason(""); setRejectingId(null)
      toast({ title: "Request Rejected", variant: "destructive" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const pending = requests.filter(r => r.status === "pending")
  const approved = requests.filter(r => r.status === "approved")
  const rejected = requests.filter(r => r.status === "rejected")

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  const RequestRow = ({ req, tab }: { req: VerifRequest; tab: string }) => (
    <Card>
      <CardContent className="p-4 space-y-3">

        {/* User info — FIXED: now shows full name, email AND phone like admin dashboard */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary text-lg">
            {req.userName?.[0]?.toUpperCase() || <User className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{req.userName || "Unknown User"}</p>
            <div className="flex flex-col gap-0.5 mt-0.5">
              {req.userEmail && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {req.userEmail}
                </span>
              )}
              {req.userPhone && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {req.userPhone}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {req.createdAt?.toDate?.().toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                {" · "}
                {req.createdAt?.toDate?.().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <Badge className={req.type === "nin" ? "bg-blue-100 text-blue-800 shrink-0" : "bg-purple-100 text-purple-800 shrink-0"}>
            {req.type?.toUpperCase()}
          </Badge>
        </div>

        {/* Submitted value — masked, tap to reveal */}
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">{req.type === "nin" ? "NIN Number" : "BVN Number"}</p>
            <span className="font-mono text-sm tracking-wider">
              {showValue[req.id]
                ? req.value
                : req.value?.slice(0, 3) + "•••••••"}
            </span>
          </div>
          <button
            onClick={() => setShowValue(p => ({ ...p, [req.id]: !p[req.id] }))}
            className="text-muted-foreground hover:text-primary p-1"
          >
            {showValue[req.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Document image if submitted */}
        {req.documentUrl ? (
          <a href={req.documentUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img src={req.documentUrl} alt="ID document" className="w-full h-32 object-cover rounded-lg border hover:opacity-80 transition" />
          </a>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/30 rounded-lg px-3 py-2">
            📄 No document image submitted — number only.
          </p>
        )}

        {/* Rejection reason if rejected */}
        {req.rejectionReason && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            Rejection reason: {req.rejectionReason}
          </p>
        )}

        {/* Actions */}
        {tab === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-accent hover:bg-accent/90 text-white"
              size="sm"
              onClick={() => handleApprove(req)}
              disabled={processing === req.id}
            >
              {processing === req.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { setRejectingId(req.id); setRejectOpen(true) }}
              disabled={processing === req.id}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}

        {tab === "approved" && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
            <CheckCircle className="h-4 w-4" /> Approved
          </div>
        )}

        {tab === "rejected" && (
          <div className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
            <XCircle className="h-4 w-4" /> Rejected
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="container py-8 max-w-2xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Verifications
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pending.length > 0
            ? <strong className="text-amber-600">{pending.length} pending review.</strong>
            : "All verifications are up to date."}
        </p>
      </div>

      <Tabs defaultValue={pending.length > 0 ? "pending" : "approved"}>
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="pending" className="flex-1">
            Pending NIN
            {pending.filter(r => r.type === "nin").length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pending.filter(r => r.type === "nin").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex-1">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected" className="flex-1">Rejected ({rejected.length})</TabsTrigger>
          <TabsTrigger value="bvn" className="flex-1 text-purple-600">
            Pro BVN
            {pending.filter(r => r.type === "bvn").length > 0 && (
              <span className="ml-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pending.filter(r => r.type === "bvn").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {pending.filter(r => r.type === "nin").length === 0
            ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">No pending NIN requests.</div>
            : pending.filter(r => r.type === "nin").map(r => <RequestRow key={r.id} req={r} tab="pending" />)}
        </TabsContent>

        <TabsContent value="bvn" className="space-y-3">
          {pending.filter(r => r.type === "bvn").length === 0
            ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">No pending BVN requests.</div>
            : pending.filter(r => r.type === "bvn").map(r => <RequestRow key={r.id} req={r} tab="pending" />)}
        </TabsContent>

        <TabsContent value="approved" className="space-y-3">
          {approved.length === 0
            ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">No approved verifications.</div>
            : approved.map(r => <RequestRow key={r.id} req={r} tab="approved" />)}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-3">
          {rejected.length === 0
            ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">No rejected verifications.</div>
            : rejected.map(r => <RequestRow key={r.id} req={r} tab="rejected" />)}
        </TabsContent>
      </Tabs>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
            <DialogDescription>Give a reason so the user knows what to fix and resubmit.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g., NIN number does not match your registered name. Please resubmit with your correct details..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectReason("") }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={!rejectReason.trim() || !!processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
