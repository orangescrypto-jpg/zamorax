"use client"
import type { ZamoraxShipment } from "@/src/types"
import { toDate } from "@/lib/toDate"

import {AdminService, where, orderBy, query, onSnapshot, serverTimestamp} from "@/src/services"

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { FBZBadge } from "@/components/fbz/FBZBadge"
import {
  Warehouse, Package, CheckCircle, XCircle,
  Loader2, ScanLine, Truck, BarChart3, Zap
} from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: "Awaiting Drop-off", color: "bg-amber-100 text-amber-700 border-amber-200" },
  received: { label: "At Warehouse",      color: "bg-blue-100 text-blue-700 border-blue-200" },
  active:   { label: "FBZ Live",          color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  depleted: { label: "Out of Stock",      color: "bg-gray-100 text-gray-600 border-gray-200" },
  rejected: { label: "Rejected",          color: "bg-red-100 text-red-700 border-red-200" },
}

export default function AdminFBZPage() {
  const { toast } = useToast()

  const [shipments, setShipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  // Intake dialog
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [intakeShipment, setIntakeShipment] = useState<any>(null)
  const [actualQty, setActualQty] = useState("")
  const [warehouseSlot, setWarehouseSlot] = useState("")
  const [intakeNotes, setIntakeNotes] = useState("")

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection("fbzShipments", docs => { setShipments(docs.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      [orderBy("createdAt", "desc")]
    )
    return unsub
  }, [])

  // Mark as received at warehouse
  const handleMarkReceived = async (shipment: ZamoraxShipment) => {
    setProcessing(shipment.id)
    try {
      await AdminService.updateDoc("fbzShipments", shipment.id, {
        status: "received",
        receivedAt: serverTimestamp(),
      })
      // Notify seller
      await AdminService.addDoc("notifications", {
        userId: shipment.sellerId,
        type: "system",
        title: "📦 Stock received at Zamorax warehouse",
        body: `Your shipment of "${shipment.listingTitle}" has arrived. We're inspecting now.`,
        link: `/dashboard/fbz`,
        isRead: false,
        createdAt: serverTimestamp(),
      })
      toast({ title: "Marked as received", variant: "success" })
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
    setProcessing(null)
  }

  // Activate FBZ after inspection
  const handleActivate = async () => {
    if (!intakeShipment) return
    const qty = parseInt(actualQty)
    if (!qty || qty < 1) {
      toast({ title: "Enter actual quantity received", variant: "destructive" }); return
    }

    setProcessing(intakeShipment.id)
    try {
      // Update shipment
      await AdminService.updateDoc("fbzShipments", intakeShipment.id, {
        status: "active",
        quantityAvailable: qty,
        warehouseSlot: warehouseSlot.trim() || null,
        intakeNotes: intakeNotes.trim() || null,
        activatedAt: serverTimestamp(),
      })

      // Update listing — add FBZ flag
      await AdminService.updateDoc("listings", intakeShipment.listingId, {
        isFBZ: true,
        fbzQuantity: qty,
        fbzShipmentId: intakeShipment.id,
        updatedAt: serverTimestamp(),
      })

      // Notify seller
      await AdminService.addDoc("notifications", {
        userId: intakeShipment.sellerId,
        type: "system",
        title: "⚡ FBZ is LIVE for your listing!",
        body: `"${intakeShipment.listingTitle}" now has the FBZ badge. ${qty} units ready to ship.`,
        link: `/dashboard/fbz`,
        isRead: false,
        createdAt: serverTimestamp(),
      })

      toast({ title: "FBZ Activated! ⚡", description: `${qty} units live for "${intakeShipment.listingTitle}"`, variant: "success" })
      setIntakeOpen(false)
      setActualQty("")
      setWarehouseSlot("")
      setIntakeNotes("")
      setIntakeShipment(null)
    } catch (e) {
      toast({ title: "Error activating FBZ", variant: "destructive" })
    }
    setProcessing(null)
  }

  // Reject shipment
  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return
    const shipment = shipments.find(s => s.id === rejectingId)
    setProcessing(rejectingId)
    try {
      await AdminService.updateDoc("fbzShipments", rejectingId, {
        status: "rejected",
        rejectionReason: rejectReason.trim(),
        rejectedAt: serverTimestamp(),
      })
      if (shipment) {
        await AdminService.addDoc("notifications", {
          userId: shipment.sellerId,
          type: "system",
          title: "FBZ Shipment Rejected",
          body: `Your shipment of "${shipment.listingTitle}" was rejected: ${rejectReason.trim()}`,
          link: `/dashboard/fbz`,
          isRead: false,
          createdAt: serverTimestamp(),
        })
      }
      setRejectOpen(false); setRejectReason(""); setRejectingId(null)
      toast({ title: "Shipment rejected", variant: "destructive" })
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
    setProcessing(null)
  }

  const byStatus = (status: string) => shipments.filter(s => s.status === status)
  const pending = byStatus("pending")
  const received = byStatus("received")
  const active = byStatus("active")
  const depleted = byStatus("depleted")
  const rejected = byStatus("rejected")
  const totalUnits = active.reduce((sum, s) => sum + (s.quantityAvailable || 0), 0)

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary" />
            FBZ Warehouse
            <FBZBadge size="xs" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage inbound shipments, inspect stock, and activate FBZ listings.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending drop-off", value: pending.length, color: "text-amber-600" },
          { label: "At warehouse",     value: received.length, color: "text-blue-600" },
          { label: "FBZ Live",         value: active.length,   color: "text-emerald-600" },
          { label: "Units in stock",   value: totalUnits,      color: "text-primary" },
        ].map(({ label, value, color }) => (
          <Card key={label}><CardContent className="p-4 text-center space-y-1">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="pending">
            Pending {pending.length > 0 && <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="received">
            Received {received.length > 0 && <span className="ml-1.5 bg-blue-500 text-white text-[10px] rounded-full px-1.5">{received.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="active">Live ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* PENDING — awaiting seller drop-off */}
        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length === 0 && <EmptyState icon={<Package />} text="No pending shipments" />}
          {pending.map(s => (
            <ShipmentCard key={s.id} shipment={s}>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => handleMarkReceived(s)}
                  disabled={processing === s.id}
                >
                  {processing === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                    <><ScanLine className="h-3.5 w-3.5 mr-1.5" /> Mark Received</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => { setRejectingId(s.id); setRejectOpen(true) }}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
              </div>
            </ShipmentCard>
          ))}
        </TabsContent>

        {/* RECEIVED — inspect and activate */}
        <TabsContent value="received" className="space-y-3 mt-4">
          {received.length === 0 && <EmptyState icon={<Truck />} text="No stock awaiting inspection" />}
          {received.map(s => (
            <ShipmentCard key={s.id} shipment={s}>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-primary to-emerald-500 text-white"
                  onClick={() => { setIntakeShipment(s); setActualQty(String(s.quantity)); setIntakeOpen(true) }}
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5 fill-white" /> Inspect & Activate FBZ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => { setRejectingId(s.id); setRejectOpen(true) }}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                </Button>
              </div>
            </ShipmentCard>
          ))}
        </TabsContent>

        {/* ACTIVE — live FBZ listings */}
        <TabsContent value="active" className="space-y-3 mt-4">
          {active.length === 0 && <EmptyState icon={<Zap />} text="No active FBZ listings" />}
          {active.map(s => (
            <ShipmentCard key={s.id} shipment={s}>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">
                  Slot: <span className="font-medium text-secondary">{s.warehouseSlot || "—"}</span>
                </span>
                <span className="text-emerald-600 font-semibold text-sm">
                  {s.quantityAvailable} units available
                </span>
              </div>
            </ShipmentCard>
          ))}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {[...depleted, ...rejected].length === 0 && <EmptyState icon={<BarChart3 />} text="No history yet" />}
          {[...depleted, ...rejected].map(s => (
            <ShipmentCard key={s.id} shipment={s} />
          ))}
        </TabsContent>
      </Tabs>

      {/* Intake / Activate Dialog */}
      <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary fill-primary" /> Activate FBZ
            </DialogTitle>
          </DialogHeader>
          {intakeShipment && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">{intakeShipment.listingTitle}</p>
                <p className="text-muted-foreground text-xs">Seller claimed: {intakeShipment.quantity} units</p>
              </div>
              <div className="space-y-1.5">
                <Label>Actual quantity received (after inspection)</Label>
                <Input
                  type="number"
                  min="1"
                  value={actualQty}
                  onChange={e => setActualQty(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse slot / shelf location</Label>
                <Input
                  value={warehouseSlot}
                  onChange={e => setWarehouseSlot(e.target.value)}
                  placeholder="e.g. A3-Shelf2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Intake notes (optional)</Label>
                <Textarea
                  value={intakeNotes}
                  onChange={e => setIntakeNotes(e.target.value)}
                  placeholder="Condition notes, discrepancies..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIntakeOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-primary to-emerald-500 text-white"
              onClick={handleActivate}
              disabled={processing === intakeShipment?.id}
            >
              {processing === intakeShipment?.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><CheckCircle className="h-4 w-4 mr-1.5" /> Activate FBZ</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" /> Reject Shipment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">The seller will be notified with this reason.</p>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Item condition did not match listing, items were not sealed..."
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
              Reject & Notify Seller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Shared sub-components ───────────────────

function ShipmentCard({ shipment: s, children }: { shipment: ZamoraxShipment; children?: React.ReactNode }) {
  const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending
  const time = (s.createdAt as any)?.toDate ? formatDistanceToNow((s.createdAt as any).toDate(), { addSuffix: true }) : ""

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
            {s.listingImage
              ? <img src={s.listingImage} alt="" className="w-full h-full object-cover" />
              : <Package className="h-6 w-6 m-4 text-muted-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm truncate">{s.listingTitle}</p>
              <Badge className={`${cfg.color} border text-xs shrink-0`}>{cfg.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.sellerName} · {(s as unknown as { quantity: number; listingPrice: number }).quantity} units · {formatPrice((s as unknown as { quantity: number; listingPrice: number }).listingPrice)}
            </p>
            <p className="text-xs text-muted-foreground">
              ID: {s.id.slice(0, 8).toUpperCase()} · {time}
            </p>
            {s.notes && (
              <p className="text-xs text-muted-foreground italic mt-1">"{s.notes}"</p>
            )}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground space-y-2">
      <div className="h-10 w-10 mx-auto opacity-20">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  )
}
