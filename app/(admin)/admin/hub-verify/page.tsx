"use client"

import {AdminService, where, orderBy, query, onSnapshot, serverTimestamp} from "@/src/services"
import { DocumentData } from "firebase/firestore"
// app/(admin)/admin/hub-verify/page.tsx

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, CheckCircle, XCircle, Loader2, Package, ExternalLink } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"
type HubRequest = DocumentData & { id: string }

export default function AdminHubVerifyPage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<HubRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection("hubVerificationRequests", docs => { setRequests(docs.map(d => ({ ...d }, [orderBy("createdAt", "desc")]))); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const handleApprove = async (req: HubRequest) => {
    setProcessing(req.id)
    try {
      await AdminService.updateDoc("hubVerificationRequests", req.id, {
        status: "approved", approvedAt: serverTimestamp(),
      })
      await AdminService.updateDoc("listings", req.listingId, {
        isHubVerified: true, hubVerifiedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      toast({ title: "Hub Verified ✅", description: `${req.listingTitle} is now Hub Verified.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleRejectSubmit = async () => {
    if (!rejectingId || !rejectReason.trim()) return
    setProcessing(rejectingId)
    try {
      await AdminService.updateDoc("hubVerificationRequests", rejectingId, {
        status: "rejected", rejectionReason: rejectReason.trim(), rejectedAt: serverTimestamp(),
      })
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

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-accent" /> Hub Verification Requests
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve seller hub verification requests.
          {pending.length > 0 && <strong className="text-amber-600 ml-1">{pending.length} pending.</strong>}
        </p>
      </div>

      <Tabs defaultValue={pending.length > 0 ? "pending" : "approved"}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending {pending.length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>

        {(["pending", "approved", "rejected"] as const).map(tab => {
          const list = tab === "pending" ? pending : tab === "approved" ? approved : rejected
          return (
            <TabsContent key={tab} value={tab} className="space-y-3">
              {list.length === 0 && (
                <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">
                  No {tab} requests.
                </div>
              )}
              {list.map(req => (
                <Card key={req.id}>
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0">
                        {req.listingImage
                          ? <img src={req.listingImage} alt="" className="w-full h-full object-cover" />
                          : <Package className="h-6 w-6 m-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{req.listingTitle}</p>
                        <p className="text-xs text-muted-foreground">Seller: {req.sellerName} · {req.sellerEmail}</p>
                        <p className="text-xs text-muted-foreground">{req.createdAt?.toDate?.().toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className="bg-accent/10 text-accent">{formatPrice(req.fee || 100000)} fee</Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/listings/${req.listingId}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>

                    {tab === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" className="bg-accent hover:bg-accent/90 text-white" onClick={() => handleApprove(req)} disabled={processing === req.id}>
                          {processing === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setRejectingId(req.id); setRejectOpen(true) }} disabled={processing === req.id}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                    {tab === "approved" && <div className="text-sm text-green-600 font-medium flex items-center gap-1 shrink-0"><CheckCircle className="h-4 w-4" /> Verified</div>}
                    {tab === "rejected" && (
                      <div className="text-sm text-red-600 shrink-0">
                        <div className="flex items-center gap-1"><XCircle className="h-4 w-4" /> Rejected</div>
                        {req.rejectionReason && <p className="text-xs text-muted-foreground mt-0.5 max-w-[160px] truncate">{req.rejectionReason}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )
        })}
      </Tabs>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Hub Verification</DialogTitle>
            <DialogDescription>Explain what the seller needs to fix before reapplying.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="e.g., Item condition does not match description. Please ensure item is clean and fully functional before resubmitting..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
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
