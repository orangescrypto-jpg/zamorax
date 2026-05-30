"use client"
import type { Order } from "@/src/types"

import {AdminService, serverTimestamp} from "@/src/services"
// components/orders/SellerOrderCard.tsx
// UPDATED: Adds Zamorax Logistics drop-off flow

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { formatPrice } from "@/lib/utils"
import { SHIPMENT_STATUS_CONFIG } from "@/src/types"
import {
  Check, X, Truck, AlertTriangle, Package, MapPin, Loader2, QrCode,
} from "lucide-react"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-yellow-100 text-yellow-800",
  escrow_held: "bg-blue-100 text-blue-800",
  shipped:     "bg-purple-100 text-purple-800",
  delivered:   "bg-orange-100 text-orange-800",
  completed:   "bg-green-100 text-green-800",
  cancelled:   "bg-red-100 text-red-800",
  disputed:    "bg-red-100 text-red-700",
}

export function SellerOrderCard({ order }: { order: Order }) {
  const uid = useAuthStore(s => s.user?.uid)
  const { toast } = useToast()
  const [tracking, setTracking] = useState(order.trackingNumber || "")
  const [loading, setLoading] = useState(false)

  // Drop-off dialog
  const [dropoffOpen, setDropoffOpen] = useState(false)
  const [agentName, setAgentName] = useState("")
  const [agentAddress, setAgentAddress] = useState("")
  const [droppingOff, setDroppingOff] = useState(false)

  const orderAny = order as any
  const isLogistics = orderAny.deliveryMethod === "zamorax_logistics"
  const shipmentStatus = orderAny.shipmentStatus as string | undefined

  const updateStatus = async (newStatus: string) => {
    if (!uid) return
    setLoading(true)
    try {
      await AdminService.updateDoc("orders", order.id, {
        status: newStatus,
        trackingNumber: tracking || null,
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Order Updated", description: `Status set to ${newStatus.replace("_", " ")}`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  // Seller confirms drop-off at agent
  const handleConfirmDropoff = async () => {
    if (!agentName.trim() || !agentAddress.trim()) {
      toast({ title: "Enter agent name and address", variant: "destructive" }); return
    }
    setDroppingOff(true)
    try {
      // Update shipment
      if (orderAny.shipmentId) {
        await AdminService.updateDoc("shipments", orderAny.shipmentId, {
          status: "dropped_off",
          originAgentName: agentName.trim(),
          currentAgentId: null,
          currentAgentName: agentName.trim(),
          updatedAt: serverTimestamp(),
          timeline: (orderAny.shipmentTimeline || []).concat([{
            status: "dropped_off",
            agentName: agentName.trim(),
            note: `Seller dropped off at: ${agentAddress.trim()}`,
            timestamp: new Date().toISOString(),
          }]),
        })
      }

      // Update order status
      await AdminService.updateDoc("orders", order.id, {
        status: "shipped",
        shipmentStatus: "dropped_off",
        updatedAt: serverTimestamp(),
      })

      // Notify buyer
      await AdminService.addDoc("notifications", {
        userId: order.buyerId,
        type: "system",
        title: "📦 Your item has been dropped off!",
        body: `"${order.itemTitle}" is now with a Zamorax agent and on its way to you. Track: ${orderAny.trackingCode}`,
        link: `/dashboard/buyer/orders/${order.id}`,
        read: false,
        createdAt: serverTimestamp(),
      })

      toast({ title: "Drop-off confirmed! ✅", description: "Buyer has been notified.", variant: "success" })
      setDropoffOpen(false)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setDroppingOff(false) }
  }

  return (
    <>
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{order.itemTitle || "Untitled Item"}</h3>
              <Badge className={STATUS_COLORS[order.status] || "bg-gray-100"}>
                {order.status?.replace(/_/g, " ")}
              </Badge>
              {/* Delivery method badge */}
              {isLogistics && (
                <Badge className="bg-primary/10 text-primary text-[10px] flex items-center gap-0.5">
                  <Package className="h-2.5 w-2.5" /> ZML
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              Buyer: {order.buyerName || "N/A"} · {order.orderType === "rental" ? "Rental" : "Sale"}
            </p>
            <p className="font-bold text-primary">{formatPrice(order.totalAmount)}</p>

            {/* Tracking code for logistics orders */}
            {isLogistics && orderAny.trackingCode && (
              <p className="text-xs text-muted-foreground font-mono">
                Track: {orderAny.trackingCode}
              </p>
            )}

            {/* Shipment status */}
            {isLogistics && shipmentStatus && SHIPMENT_STATUS_CONFIG[shipmentStatus as keyof typeof SHIPMENT_STATUS_CONFIG] && (
              <Badge className={`${SHIPMENT_STATUS_CONFIG[shipmentStatus as keyof typeof SHIPMENT_STATUS_CONFIG].color} text-[10px]`}>
                {SHIPMENT_STATUS_CONFIG[shipmentStatus as keyof typeof SHIPMENT_STATUS_CONFIG].label}
              </Badge>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {/* ── ZAMORAX LOGISTICS FLOW ── */}
            {isLogistics && (order.status === "escrow_held" || order.status === "pending") && (
              <Button
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => setDropoffOpen(true)}
              >
                <MapPin className="h-4 w-4 mr-2" /> Confirm Drop-off
              </Button>
            )}

            {isLogistics && order.status === "shipped" && shipmentStatus === "dropped_off" && (
              <Button variant="outline" disabled className="opacity-70">
                <Package className="h-4 w-4 mr-2" /> In Transit…
              </Button>
            )}

            {/* ── STANDARD FLOW (meetup / FBZ) ── */}
            {!isLogistics && order.status === "pending" && order.orderType === "rental" && (
              <>
                <Button onClick={() => updateStatus("escrow_held")} className="bg-primary text-white"><Check className="h-4 w-4 mr-2" /> Accept</Button>
                <Button onClick={() => updateStatus("cancelled")} variant="destructive"><X className="h-4 w-4 mr-2" /> Decline</Button>
              </>
            )}
            {!isLogistics && (order.status === "escrow_held" || order.status === "pending") && order.orderType !== "rental" && (
              <>
                <Input placeholder="Tracking #" value={tracking} onChange={e => setTracking(e.target.value)} className="bg-background w-36" />
                <Button onClick={() => updateStatus("shipped")} disabled={loading}>
                  <Truck className="h-4 w-4 mr-2" /> {loading ? "Updating…" : "Mark Shipped"}
                </Button>
              </>
            )}
            {!isLogistics && order.status === "shipped" && (
              <Button variant="outline" disabled>Waiting for Delivery</Button>
            )}

            {order.status === "completed" && (
              <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                <Check className="h-4 w-4" /> Funds Released
              </div>
            )}
            {order.status === "cancelled" && (
              <div className="flex items-center gap-2 text-red-500 font-medium text-sm">
                <AlertTriangle className="h-4 w-4" /> Cancelled
              </div>
            )}
            {order.status === "disputed" && (
              <Button asChild variant="outline" size="sm" className="border-red-200 text-red-600">
                <Link href={`/dashboard/seller/orders/${order.id}`}>
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" /> View Dispute
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Drop-off confirmation dialog */}
      <Dialog open={dropoffOpen} onOpenChange={setDropoffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Confirm Agent Drop-off
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm space-y-1">
              <p className="font-medium">"{order.itemTitle}"</p>
              {orderAny.trackingCode && (
                <p className="text-xs text-muted-foreground font-mono">Tracking: {orderAny.trackingCode}</p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Confirm the agent you dropped the item off at. The buyer will be notified immediately.
            </p>

            <div className="space-y-1.5">
              <Label>Agent / Store Name</Label>
              <Input
                placeholder="e.g. Bayo Stores, Ikeja"
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Agent Address</Label>
              <Input
                placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos"
                value={agentAddress}
                onChange={e => setAgentAddress(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDropoffOpen(false)}>Cancel</Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={handleConfirmDropoff}
              disabled={droppingOff || !agentName.trim() || !agentAddress.trim()}
            >
              {droppingOff
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Check className="h-4 w-4 mr-1.5" /> Confirm Drop-off</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
