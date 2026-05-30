"use client"

import { AdminService , serverTimestamp } from "@/src/services"
// components/shared/EscrowConfirmModal.tsx
// UPDATED: Now creates shipment + notifies seller to drop off when delivery = zamorax_logistics

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ShieldCheck, AlertTriangle, Package } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { DeliveryMethodSelector, type DeliveryMethodMeta } from "@/components/logistics/DeliveryMethodSelector"
import { generateTrackingCode, type DeliveryMethod, type ShipmentStatus } from "@/src/types"

interface Props {
  orderId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm?: () => void
  // Pre-filled from listing page
  sellerState?: string
  buyerState?: string
  isFBZ?: boolean
}

export function EscrowConfirmModal({ orderId, open, onOpenChange, onConfirm, sellerState = "", buyerState = "", isFBZ = false }: Props) {
  const [note, setNote]             = useState("")
  const [accepted, setAccepted]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const { toast } = useToast()

  // Delivery selection
  const [deliveryMethod, setDeliveryMethod]   = useState<DeliveryMethod>("meetup")
  const [deliveryMeta, setDeliveryMeta]       = useState<DeliveryMethodMeta>({ deliveryFee: 0 })

  const handleDeliveryChange = (method: DeliveryMethod, meta: DeliveryMethodMeta) => {
    setDeliveryMethod(method)
    setDeliveryMeta(meta)
  }

  const handleConfirm = async () => {
    if (!accepted) {
      toast({ title: "Please confirm the checkbox first", variant: "destructive" })
      return
    }
    if (deliveryMethod === "zamorax_logistics" && !deliveryMeta.destinationAgentId) {
      toast({ title: "Please select a pickup agent", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      // Load order to get buyer/seller info
      const orderSnap = await AdminService.getDoc("orders", orderId)
      const order = orderSnap!

      // Update order with delivery method
      await AdminService.updateDoc("orders", orderId, {
        deliveryMethod,
        deliveryFee: deliveryMeta.deliveryFee,
        status: "escrow_held",
        escrowHeldAt: serverTimestamp(),
        buyerFeedback: note,
        updatedAt: serverTimestamp(),
      })

      // Create shipment if Zamorax Logistics
      if (deliveryMethod === "zamorax_logistics") {
        const trackingCode = generateTrackingCode()

        // Find origin agent (nearest to seller state)
        // For now we assign automatically — in v2 seller can choose too
        const shipmentRef = await AdminService.addDoc("shipments", {
          orderId,
          listingId:      order.listingId,
          listingTitle:   order.itemTitle,
          listingImage:   order.itemImage || null,

          sellerId:       order.sellerId,
          sellerName:     order.sellerName,
          sellerPhone:    order.sellerPhone || null,

          buyerId:        order.buyerId,
          buyerName:      order.buyerName,
          buyerPhone:     order.buyerPhone || null,
          buyerAddress:   order.buyerAddress || null,
          buyerState,

          originAgentId:          null,       // assigned by admin or auto-match
          originAgentName:        null,
          destinationAgentId:     deliveryMeta.destinationAgentId,
          destinationAgentName:   deliveryMeta.destinationAgentName,

          deliveryType:   deliveryMeta.deliveryType || "agent_pickup",
          deliveryFee:    deliveryMeta.deliveryFee,
          trackingCode,

          status: "awaiting_dropoff" as ShipmentStatus,
          timeline: [{
            status: "awaiting_dropoff",
            note: "Order confirmed. Waiting for seller to drop off at origin agent.",
            timestamp: new Date().toISOString(),
          }],

          estimatedDeliveryDays: deliveryMeta.estimatedDays || 5,
          currentAgentId:   null,
          currentAgentName: null,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        // Save shipment ref on order
        await AdminService.updateDoc("orders", orderId, {
          shipmentId:   shipmentRef.id,
          trackingCode,
        })

        // Notify seller to drop off
        await AdminService.addDoc("notifications", {
          userId: order.sellerId,
          type: "system",
          title: "📦 Drop off your item — order confirmed!",
          body: `Buyer chose Zamorax Logistics. Drop "${order.itemTitle}" at your nearest Zamorax agent. Tracking: ${trackingCode}`,
          link: `/dashboard/seller/orders/${orderId}`,
          read: false,
          createdAt: serverTimestamp(),
        })

        toast({
          title: "Order confirmed! 📦",
          description: `Tracking code: ${trackingCode}. Seller has been asked to drop off.`,
          variant: "success",
        })
      } else {
        toast({ title: "Order confirmed!", description: "Payment is safely in escrow.", variant: "success" })
      }

      onOpenChange(false)
      onConfirm?.()
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary" /> Confirm Order & Choose Delivery
          </DialogTitle>
          <DialogDescription>
            Your payment goes into escrow. Choose how you want to receive the item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Delivery method selector */}
          <DeliveryMethodSelector
            sellerState={sellerState}
            buyerState={buyerState}
            isFBZ={isFBZ}
            value={deliveryMethod}
            onChange={handleDeliveryChange}
          />

          {/* Logistics warning */}
          {deliveryMethod === "zamorax_logistics" && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
              <Package className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                After confirming, the seller will be notified to drop the item at their nearest Zamorax agent.
                You can track your parcel with the tracking code.
              </p>
            </div>
          )}

          {/* Optional feedback */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Note to seller (optional)</Label>
            <Textarea
              placeholder="Any special instructions..."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Confirm checkbox */}
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Checkbox
              checked={accepted}
              onCheckedChange={v => setAccepted(v as boolean)}
              id="confirm-check"
            />
            <label htmlFor="confirm-check" className="text-sm leading-tight cursor-pointer">
              I understand my payment will be held in escrow and only released to the seller after I confirm receipt.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!accepted || loading}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <ShieldCheck className="h-4 w-4 mr-2" />
            }
            Confirm & Lock Escrow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
