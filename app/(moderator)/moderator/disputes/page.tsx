"use client"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(moderator)/moderator/disputes/page.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ShieldAlert, Loader2, ArrowUpRight, MessageSquare, AlertTriangle } from "lucide-react"
import Link from "next/link"
import {DocumentData} from "@/src/services"

type Dispute = DocumentData & { id: string }

export default function ModeratorDisputesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [escalatingId, setEscalatingId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    const q = AdminService._ref_("disputes", [where("status", "in", ["open", "investigating", "escalated", "resolved"])])
    return onSnapshot(q, docs => {
      setDisputes(docs.map(d => ({ ...d })))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const handleInvestigate = async (dispute: Dispute) => {
    setProcessing(dispute.id)
    try {
      await AdminService.updateDoc("disputes", dispute.id, {
        status: "investigating",
        assignedMod: user?.uid,
        assignedModName: user?.fullName,
        updatedAt: serverTimestamp() })
      toast({ title: "Assigned to you", description: "Status set to Investigating.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleEscalateSubmit = async () => {
    if (!escalatingId || !notes.trim()) return
    setProcessing(escalatingId)
    try {
      await AdminService.updateDoc("disputes", escalatingId, {
        status: "escalated",
        moderatorNotes: notes.trim(),
        escalatedBy: user?.uid,
        escalatedAt: serverTimestamp(),
        updatedAt: serverTimestamp() })
      setEscalateOpen(false); setNotes(""); setEscalatingId(null)
      toast({ title: "Escalated to Admin", description: "Admin will handle the payout decision.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const open = disputes.filter(d => d.status === "open")
  const investigating = disputes.filter(d => d.status === "investigating")
  const escalated = disputes.filter(d => d.status === "escalated")
  const resolved = disputes.filter(d => d.status === "resolved")

  const statusColors: Record<string, string> = {
    open: "bg-red-100 text-red-800",
    investigating: "bg-amber-100 text-amber-800",
    escalated: "bg-purple-100 text-purple-800",
    resolved: "bg-green-100 text-green-800" }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>

  const DisputeRow = ({ d, tab }: { d: Dispute; tab: string }) => (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{d.reason}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Order #{d.orderId?.slice(-6).toUpperCase()} · Buyer: {d.buyerName} · {d.createdAt?.toDate?.().toLocaleDateString()}
            </p>
            {d.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>}
          </div>
          <Badge className={`shrink-0 ${statusColors[d.status] || "bg-gray-100 text-gray-800"}`}>{d.status}</Badge>
        </div>

        {/* Evidence photos */}
        {d.evidenceUrls?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {d.evidenceUrls.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Evidence ${i + 1}`} className="h-16 w-16 rounded-lg object-cover shrink-0 border hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        )}

        {d.moderatorNotes && (
          <div className="text-xs bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-purple-700">
            <strong>Mod notes:</strong> {d.moderatorNotes}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/buyer/orders/${d.orderId}`} target="_blank">
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> View Order
            </Link>
          </Button>

          {tab === "open" && (
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => handleInvestigate(d)} disabled={processing === d.id}>
              {processing === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><MessageSquare className="h-3.5 w-3.5 mr-1" /> Investigate</>}
            </Button>
          )}

          {tab === "investigating" && (
            <Button
              size="sm"
              variant="outline"
              className="border-purple-400 text-purple-700"
              onClick={() => { setEscalatingId(d.id); setEscalateOpen(true) }}
              disabled={processing === d.id}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Escalate to Admin
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" /> Disputes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Handle first-response. Escalate payout decisions to Admin.
        </p>
      </div>

      <Tabs defaultValue={open.length > 0 ? "open" : "investigating"}>
        <TabsList className="mb-4">
          <TabsTrigger value="open">Open {open.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 rounded-full">{open.length}</span>}</TabsTrigger>
          <TabsTrigger value="investigating">Investigating ({investigating.length})</TabsTrigger>
          <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
        </TabsList>

        {([ ["open", open], ["investigating", investigating], ["escalated", escalated], ["resolved", resolved] ] as [string, Dispute[]][]).map(([tab, list]) => (
          <TabsContent key={tab as string} value={tab as string} className="space-y-3">
            {(list as Dispute[]).length === 0
              ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">No {tab} disputes.</div>
              : (list as Dispute[]).map(d => <DisputeRow key={d.id} d={d} tab={tab as string} />)}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate to Admin</DialogTitle>
            <DialogDescription>Summarise your findings. Admin will make the final payout decision.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="e.g., Buyer has provided photos showing the item arrived damaged. Seller claims it was fine when shipped. Recommend partial refund of ₦5,000 to buyer..." value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEscalateOpen(false); setNotes("") }}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleEscalateSubmit} disabled={!notes.trim() || !!processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Escalate to Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
