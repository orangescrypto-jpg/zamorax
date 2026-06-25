"use client"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(moderator)/moderator/logistics/disputes/page.tsx
// Moderator investigates logistics-related disputes — parcel not received, wrong item, etc.

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { SHIPMENT_STATUS_CONFIG, type ZamoraxShipment } from "@/src/types"
import { formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  ShieldAlert, Loader2, ArrowUpRight, Package,
  CheckCircle, XCircle, AlertTriangle, MessageSquare,
  MapPin, Phone, Clock, Truck } from "lucide-react"
import Link from "next/link"
import {DocumentData} from "@/src/services"

type Dispute = {
  id: string
  reason?: string
  status?: string
  orderId?: string
  buyerId?: string
  sellerId?: string
  buyerName?: string
  description?: string
  evidenceUrls?: string[]
  evidenceRequested?: boolean
  moderatorNotes?: string
  shipmentId?: string
  deliveryMethod?: string
  trackingCode?: string
  createdAt?: { toDate?: () => Date; toMillis?: () => number }
  [key: string]: unknown
}

const LOGISTICS_REASONS = [
  "parcel_not_received",
  "wrong_item_delivered",
  "item_damaged_in_transit",
  "parcel_lost",
  "delayed_delivery",
]

export default function ModeratorLogisticsDisputesPage() {
  const { user }  = useAuth()
  const { toast } = useToast()

  const [disputes, setDisputes]     = useState<Dispute[]>([])
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  // Shipment details drawer
  const [selected, setSelected]     = useState<Dispute | null>(null)
  const [shipment, setShipment]     = useState<ZamoraxShipment | null>(null)
  const [loadingShipment, setLoadingShipment] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  // Ruling dialog
  const [rulingOpen, setRulingOpen] = useState(false)
  const [rulingDispute, setRulingDispute] = useState<Dispute | null>(null)
  const [verdict, setVerdict]       = useState<"refund_buyer" | "release_seller" | "escalate" | "">("")
  const [rulingNotes, setRulingNotes] = useState("")

  // Evidence request dialog
  const [evidenceOpen, setEvidenceOpen]   = useState(false)
  const [evidenceDispute, setEvidenceDispute] = useState<Dispute | null>(null)
  const [evidenceNote, setEvidenceNote]   = useState("")

  useEffect(() => {
    // Load disputes that are logistics-related OR have a shipmentId
    const q = AdminService._ref_("disputes", [where("status", "in", ["open", "investigating", "escalated", "resolved"])])
    return onSnapshot(q, docs => {
      // Filter to logistics disputes
      const all = docs.docs.map((d: any) => ({ id: d.id, ...d.data() } as any))
      const logisticsDisputes = all.filter((d: any) =>
        d.shipmentId ||
        LOGISTICS_REASONS.includes(d.reason) ||
        d.deliveryMethod === "zamorax_logistics"
      )
      setDisputes(logisticsDisputes)
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const openDetail = async (dispute: Dispute) => {
    setSelected(dispute)
    setDetailOpen(true)
    if (dispute.shipmentId) {
      setLoadingShipment(true)
      try {
        const snap = await AdminService.getDoc("shipments", dispute.shipmentId)
        if (snap) setShipment(snap as unknown as ZamoraxShipment)
      } catch {}
      finally { setLoadingShipment(false) }
    }
  }

  const handleInvestigate = async (dispute: Dispute) => {
    setProcessing(dispute.id)
    try {
      await AdminService.updateDoc("disputes", dispute.id, {
        status:           "investigating",
        assignedMod:      user?.uid,
        assignedModName:  user?.fullName || "Moderator",
        type:             "logistics",
        updatedAt:        serverTimestamp() })
      toast({ title: "Assigned to you", description: "Status set to Investigating.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleRequestEvidence = async () => {
    if (!evidenceDispute || !evidenceNote.trim()) return
    setProcessing(evidenceDispute.id)
    try {
      // Notify ZLA
      if (evidenceDispute.shipmentId) {
        const shipSnap = await AdminService.getDoc("shipments", evidenceDispute.shipmentId)
        if (shipSnap) {
          const sh = shipSnap as any
          const agentUserId = sh.currentAgentId || sh.destinationAgentId
          if (agentUserId) {
            await AdminService.addDoc("notifications", {
              userId:    agentUserId,
              type:      "system",
              title:     "⚠️ Evidence requested for a dispute",
              body:      `Please provide photo/video evidence for parcel ${sh.trackingCode}. ${evidenceNote}`,
              link:      `/dashboard/zla`,
              read:      false,
              createdAt: serverTimestamp() })
          }
        }
      }

      // Update dispute
      await AdminService.updateDoc("disputes", evidenceDispute.id, {
        evidenceRequested:     true,
        evidenceRequestedAt:   serverTimestamp(),
        evidenceRequestNote:   evidenceNote.trim(),
        evidenceRequestedBy:   user?.uid,
        updatedAt:             serverTimestamp() })

      toast({ title: "Evidence request sent to ZLA", variant: "success" })
      setEvidenceOpen(false)
      setEvidenceNote("")
      setEvidenceDispute(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleRuling = async () => {
    if (!rulingDispute || !verdict || !rulingNotes.trim()) return
    setProcessing(rulingDispute.id)
    try {
      if (verdict === "escalate") {
        await AdminService.updateDoc("disputes", rulingDispute.id, {
          status:          "escalated",
          moderatorNotes:  rulingNotes.trim(),
          escalatedBy:     user?.uid,
          escalatedAt:     serverTimestamp(),
          updatedAt:       serverTimestamp() })
        toast({ title: "Escalated to Admin", variant: "success" })
      } else {
        // Mod makes the call — update dispute + order
        await AdminService.updateDoc("disputes", rulingDispute.id, {
          status:         "resolved",
          verdict,
          moderatorNotes: rulingNotes.trim(),
          resolvedBy:     user?.uid,
          resolvedAt:     serverTimestamp(),
          updatedAt:      serverTimestamp() })

        // Update order escrow based on verdict
        if (rulingDispute.orderId) {
          await AdminService.updateDoc("orders", rulingDispute.orderId, {
            status:       verdict === "refund_buyer" ? "refunded" : "completed",
            escrowStatus: verdict === "refund_buyer" ? "refunded_to_buyer" : "released_to_seller",
            updatedAt:    serverTimestamp() })
        }

        // Notify both parties
        const title   = verdict === "refund_buyer" ? "Dispute resolved — refund issued" : "Dispute resolved — payment released"
        const buyers  = verdict === "refund_buyer"
          ? "Your dispute has been reviewed. A refund has been issued."
          : "Your dispute has been reviewed. The seller has been paid."
        const sellers = verdict === "refund_buyer"
          ? "The dispute was resolved in the buyer's favour. Payment has been refunded."
          : "The dispute was resolved in your favour. Payment has been released."

        await Promise.all([
          AdminService.addDoc("notifications", {
            userId: rulingDispute.buyerId, type: "system", title, body: buyers,
            link: `/dashboard/buyer/orders/${rulingDispute.orderId}`, read: false, createdAt: serverTimestamp() }),
          AdminService.addDoc("notifications", {
            userId: rulingDispute.sellerId, type: "system", title, body: sellers,
            link: `/dashboard/seller/orders/${rulingDispute.orderId}`, read: false, createdAt: serverTimestamp() }),
        ])

        toast({ title: "Ruling applied!", description: `${verdict === "refund_buyer" ? "Refund issued" : "Payment released"}.`, variant: "success" })
      }

      setRulingOpen(false)
      setRulingNotes("")
      setVerdict("")
      setRulingDispute(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const open         = disputes.filter(d => d.status === "open")
  const investigating = disputes.filter(d => d.status === "investigating")
  const escalated    = disputes.filter(d => d.status === "escalated")
  const resolved     = disputes.filter(d => d.status === "resolved")

  const statusColors: Record<string, string> = {
    open:          "bg-red-100 text-red-800",
    investigating: "bg-amber-100 text-amber-800",
    escalated:     "bg-purple-100 text-purple-800",
    resolved:      "bg-emerald-100 text-emerald-800" }

  const reasonLabel: Record<string, string> = {
    parcel_not_received:    "Parcel Not Received",
    wrong_item_delivered:   "Wrong Item Delivered",
    item_damaged_in_transit:"Damaged in Transit",
    parcel_lost:            "Parcel Lost",
    delayed_delivery:       "Delayed Delivery" }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  const DisputeRow = ({ d, tab }: { d: Dispute; tab: string }) => (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary text-[10px]">
                <Package className="h-2.5 w-2.5 mr-0.5" /> Logistics
              </Badge>
              <p className="font-semibold text-sm">
                {reasonLabel[d.reason] || d.reason?.replace(/_/g, " ") || "Dispute"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Order #{d.orderId?.slice(-6).toUpperCase()} ·
              Buyer: {d.buyerName || "—"} ·
              {d.createdAt?.toDate ? formatDistanceToNow(d.createdAt.toDate(), { addSuffix: true }) : ""}
            </p>
            {d.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 italic">"{d.description}"</p>
            )}
            {d.trackingCode && (
              <p className="text-xs font-mono text-muted-foreground">Tracking: {d.trackingCode}</p>
            )}
            {d.evidenceRequested && !d.evidenceUrls?.length && (
              <Badge className="bg-amber-100 text-amber-800 text-[10px]">⏳ Evidence requested</Badge>
            )}
          </div>
          <Badge className={`shrink-0 ${statusColors[d.status ?? ""] || "bg-gray-100"}`}>{d.status}</Badge>
        </div>

        {/* Evidence photos */}
        {(d.evidenceUrls?.length ?? 0) > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {d.evidenceUrls.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Evidence ${i + 1}`} className="h-16 w-16 rounded-lg object-cover shrink-0 border" />
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
          <Button variant="ghost" size="sm" onClick={() => openDetail(d)}>
            <Package className="h-3.5 w-3.5 mr-1" /> View Shipment
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/buyer/orders/${d.orderId}`} target="_blank">
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> View Order
            </Link>
          </Button>

          {tab === "open" && (
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => handleInvestigate(d)} disabled={processing === d.id}
            >
              {processing === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><MessageSquare className="h-3.5 w-3.5 mr-1" /> Investigate</>}
            </Button>
          )}

          {tab === "investigating" && (
            <>
              <Button size="sm" variant="outline"
                onClick={() => { setEvidenceDispute(d); setEvidenceOpen(true) }}
                disabled={processing === d.id}
              >
                <Package className="h-3.5 w-3.5 mr-1" /> Request Evidence
              </Button>
              <Button size="sm" className="bg-primary text-white hover:bg-primary/90"
                onClick={() => { setRulingDispute(d); setRulingOpen(true) }}
                disabled={processing === d.id}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Make Ruling
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" /> Logistics Disputes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Investigate parcel disputes. View shipment timeline, contact ZLA, and make rulings.
        </p>
      </div>

      <Tabs defaultValue="open">
        <TabsList className="mb-4">
          <TabsTrigger value="open">
            Open {open.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 rounded-full">{open.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="investigating">Investigating ({investigating.length})</TabsTrigger>
          <TabsTrigger value="escalated">Escalated ({escalated.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
        </TabsList>

        {([["open", open], ["investigating", investigating], ["escalated", escalated], ["resolved", resolved]] as [string, Dispute[]][]).map(([tab, list]) => (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {list.length === 0
              ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">No {tab} logistics disputes.</div>
              : list.map((d: any) => <DisputeRow key={d.id} d={d} tab={tab} />)
            }
          </TabsContent>
        ))}
      </Tabs>

      {/* Shipment Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={v => { setDetailOpen(v); if (!v) { setShipment(null); setSelected(null) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Shipment Details
            </DialogTitle>
          </DialogHeader>

          {loadingShipment ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !shipment ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No shipment record found for this dispute.</p>
          ) : (
            <div className="space-y-4 py-2">
              {/* Tracking + status */}
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm font-bold">{shipment.trackingCode}</p>
                <Badge className={SHIPMENT_STATUS_CONFIG[shipment.status]?.color}>
                  {SHIPMENT_STATUS_CONFIG[shipment.status]?.label}
                </Badge>
              </div>

              {/* Item */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-semibold">{shipment.listingTitle}</p>
                <p className="text-muted-foreground text-xs">Delivery fee: {formatPrice(shipment.deliveryFee)}</p>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Seller</p>
                  <p className="text-sm font-medium">{shipment.sellerName}</p>
                  {shipment.sellerPhone && (
                    <a href={`tel:${shipment.sellerPhone}`} className="text-xs text-primary flex items-center gap-1">
                      <Phone className="h-3 w-3" />{shipment.sellerPhone}
                    </a>
                  )}
                </div>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Buyer</p>
                  <p className="text-sm font-medium">{shipment.buyerName}</p>
                  {shipment.buyerPhone && (
                    <a href={`tel:${shipment.buyerPhone}`} className="text-xs text-primary flex items-center gap-1">
                      <Phone className="h-3 w-3" />{shipment.buyerPhone}
                    </a>
                  )}
                </div>
              </div>

              {/* Last known agent */}
              {shipment.currentAgentName && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700 uppercase">Last Known Location</p>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-amber-600" />{shipment.currentAgentName}
                  </p>
                </div>
              )}

              {/* Full timeline */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Timeline</p>
                {shipment.timeline?.length > 0 ? (
                  <div className="space-y-2">
                    {[...shipment.timeline].reverse().map((event, i) => {
                      const eCfg = SHIPMENT_STATUS_CONFIG[event.status as keyof typeof SHIPMENT_STATUS_CONFIG]
                      return (
                        <div key={i} className="flex items-start gap-2.5 text-sm">
                          <div className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${eCfg?.color || "bg-gray-100 text-gray-600"}`}>
                            {eCfg?.label || event.status}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              {event.agentName ? `${event.agentName} · ` : ""}
                              {event.note}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {event.timestamp
                                ? formatDistanceToNow(
                                    new Date(event.timestamp as string),
                                    { addSuffix: true }
                                  )
                                : ""}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No timeline events recorded.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            {selected && selected.status === "investigating" && (
              <Button className="bg-primary text-white" onClick={() => {
                setDetailOpen(false)
                setRulingDispute(selected)
                setRulingOpen(true)
              }}>
                Make Ruling
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Evidence Dialog */}
      <Dialog open={evidenceOpen} onOpenChange={v => { setEvidenceOpen(v); if (!v) { setEvidenceNote(""); setEvidenceDispute(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Evidence from ZLA</DialogTitle>
            <DialogDescription>The ZLA will be notified to provide photo or video proof.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Please provide a photo of the item at the time of delivery, and a photo of the buyer's signature or ID..."
            value={evidenceNote}
            onChange={e => setEvidenceNote(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvidenceOpen(false)}>Cancel</Button>
            <Button
              className="bg-primary text-white"
              onClick={handleRequestEvidence}
              disabled={!evidenceNote.trim() || !!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ruling Dialog */}
      <Dialog open={rulingOpen} onOpenChange={v => { setRulingOpen(v); if (!v) { setVerdict(""); setRulingNotes(""); setRulingDispute(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make a Ruling</DialogTitle>
            <DialogDescription>
              Your ruling applies immediately. Escalate if you need admin to decide on the payout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Verdict</p>
              <div className="space-y-2">
                {([
                  { v: "refund_buyer",    label: "Refund Buyer",      sub: "Escrow returned to buyer. Seller not paid.", color: "border-red-300 bg-red-50" },
                  { v: "release_seller",  label: "Release to Seller", sub: "Escrow released to seller. Buyer claim dismissed.", color: "border-emerald-300 bg-emerald-50" },
                  { v: "escalate",        label: "Escalate to Admin", sub: "You're unsure — pass to admin for final decision.", color: "border-purple-300 bg-purple-50" },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setVerdict(opt.v)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                      verdict === opt.v ? opt.color + " border-opacity-100" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <p className="font-semibold">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Notes / Reasoning <span className="text-red-500">*</span></p>
              <Textarea
                placeholder="Summarise your findings and reasoning for this ruling..."
                value={rulingNotes}
                onChange={e => setRulingNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRulingOpen(false)}>Cancel</Button>
            <Button
              className={verdict === "escalate" ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-primary text-white"}
              onClick={handleRuling}
              disabled={!verdict || !rulingNotes.trim() || !!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : verdict === "escalate" ? "Escalate to Admin" : "Apply Ruling"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
