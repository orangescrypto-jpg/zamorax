"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { adminFetch } from "@/lib/admin-fetch"
import { UsersService } from "@/src/services"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  ShieldCheck, CheckCircle, XCircle,
  Loader2, User, Eye, EyeOff, FileImage, RefreshCw } from "lucide-react"
import Image from "next/image"

interface VerifRequest {
  id: string
  status: string
  type?: string
  userId?: string
  userName?: string
  userEmail?: string
  nin?: string
  value?: string
  selfieUrl?: string
  documentUrl?: string
  rejectionReason?: string
  reviewedBy?: string
  createdAt?: string
  reviewedAt?: string
  [key: string]: unknown
}

export default function AdminVerificationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests]   = useState<VerifRequest[]>([])
  const [loading, setLoading]     = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [showValue, setShowValue] = useState<Record<string, boolean>>({})
  const [rejectOpen, setRejectOpen]     = useState(false)
  const [rejectingId, setRejectingId]   = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [viewingDoc, setViewingDoc]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // D1 table is verification_requests (snake_case)
      const res  = await adminFetch("/api/admin/verifications")
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleApprove = async (req: VerifRequest) => {
    if (!user?.uid) return
    setProcessing(req.id)
    try {
      await adminFetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.id, action: "approve", userId: req.userId, type: req.type }),
      })
      // Also mark ninVerified on user
      if (req.type === "nin" && req.userId) {
        await UsersService.verifySellerNIN(req.userId, true)
      }
      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: "approved" } : r
      ))
      toast({ title: `${req.type?.toUpperCase()} Approved ✅`, description: "User has been notified.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleRejectSubmit = async () => {
    if (!user?.uid || !rejectingId || !rejectReason.trim()) return
    setProcessing(rejectingId)
    try {
      await adminFetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rejectingId, action: "reject", reason: rejectReason.trim() }),
      })
      setRequests(prev => prev.map(r =>
        r.id === rejectingId ? { ...r, status: "rejected", rejectionReason: rejectReason.trim() } : r
      ))
      setRejectOpen(false); setRejectReason(""); setRejectingId(null)
      toast({ title: "Request Rejected", description: "User has been notified.", variant: "destructive" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const pending  = requests.filter(r => r.status === "pending")
  const approved = requests.filter(r => r.status === "approved")
  const rejected = requests.filter(r => r.status === "rejected")

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  const RequestCard = ({ req, tab }: { req: VerifRequest; tab: string }) => (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{req.userName || "Unknown User"}</p>
            <p className="text-xs text-muted-foreground">
              {req.userEmail || "No email"} · {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : ""}
            </p>
          </div>
          <Badge className={req.type === "nin"
            ? "bg-blue-100 text-blue-800"
            : "bg-purple-100 text-purple-800"
          }>
            {req.type?.toUpperCase()}
          </Badge>
        </div>

        {/* NIN number — masked with eye reveal */}
        <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2.5">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">NIN Number</p>
            <span className="font-mono text-sm tracking-wider">
              {showValue[req.id]
                ? (req.value || req.nin || "Not provided")
                : ((req.value || req.nin)?.slice(0, 3) ?? "???") + "•••••••"}
            </span>
          </div>
          <button
            onClick={() => setShowValue(p => ({ ...p, [req.id]: !p[req.id] }))}
            className="text-muted-foreground hover:text-primary p-1 rounded"
            title={showValue[req.id] ? "Hide number" : "Reveal number"}
          >
            {showValue[req.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* Document image */}
        {req.documentUrl ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Submitted Document</p>
            <div
              className="relative h-40 bg-muted rounded-lg overflow-hidden cursor-pointer border hover:border-primary transition-colors"
              onClick={() => setViewingDoc(req.documentUrl!)}
            >
              <Image src={req.documentUrl!} alt="Verification document" fill className="object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Tap to enlarge</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
            <FileImage className="h-4 w-4 shrink-0" />
            No document image — number only submission.
          </div>
        )}

        {/* Rejection reason */}
        {tab === "rejected" && req.rejectionReason && (
          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
            <span className="font-medium">Reason: </span>{req.rejectionReason}
          </div>
        )}

        {/* Actions */}
        {tab === "pending" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
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
              className="flex-1"
              onClick={() => { setRejectingId(req.id); setRejectOpen(true) }}
              disabled={processing === req.id}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
        {tab === "approved" && (
          <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle className="h-4 w-4" /> Approved
            {req.reviewedAt && (
              <span className="text-xs text-muted-foreground ml-1">
                · {new Date(req.reviewedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="container py-8 space-y-6 max-w-2xl pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Verification Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review NIN submissions from sellers.{" "}
            {pending.length > 0 && (
              <strong className="text-amber-600">{pending.length} pending review.</strong>
            )}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue={pending.length > 0 ? "pending" : "approved"}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="pending" className="flex-1">
            Pending NIN
            {pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex-1">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected" className="flex-1">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>

        {([ ["pending", pending], ["approved", approved], ["rejected", rejected] ] as Array<[string, VerifRequest[]]>).map(([tab, list]) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {list.length === 0 ? (
              <div className="border border-dashed rounded-xl py-14 text-center text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No {tab} requests.
              </div>
            ) : list.map(r => <RequestCard key={r.id} req={r} tab={tab} />)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Verification</DialogTitle>
            <DialogDescription>
              Give a clear reason so the user knows what to fix before resubmitting.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g., NIN does not match registered name. Please resubmit with correct details."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectOpen(false); setRejectReason("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || !!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-size document viewer */}
      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogHeader className="p-2">
            <DialogTitle>Submitted Document</DialogTitle>
          </DialogHeader>
          {viewingDoc && (
            <div className="relative w-full h-[70vh]">
              <Image src={viewingDoc} alt="Verification document" fill className="object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
