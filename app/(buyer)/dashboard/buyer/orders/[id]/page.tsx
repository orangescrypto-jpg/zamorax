"use client"

import {AdminService, onSnapshot} from "@/src/services"
// app/(buyer)/dashboard/buyer/orders/[id]/page.tsx
// UPDATED: Adds ShipmentTracker + receipt download + logistics-aware actions

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ShipmentTracker } from "@/components/logistics/ShipmentTracker"
import { formatPrice } from "@/lib/utils"
import {
  Loader2, ArrowLeft, CheckCircle, ShieldCheck,
  AlertTriangle, MessageSquare, Download, Package, Truck,
} from "lucide-react"
import Link from "next/link"

const STATUS_STEPS = ["pending", "escrow_held", "shipped", "delivered", "inspecting", "completed"]

const statusColors: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-800",
  escrow_held: "bg-blue-100 text-blue-800",
  shipped:     "bg-purple-100 text-purple-800",
  delivered:   "bg-amber-100 text-amber-800",
  inspecting:  "bg-orange-100 text-orange-800",
  completed:   "bg-emerald-100 text-emerald-800",
  disputed:    "bg-red-100 text-red-800",
  cancelled:   "bg-gray-100 text-gray-500",
}

const stepLabels: Record<string, string> = {
  pending:     "Order Placed",
  escrow_held: "Payment Secured",
  shipped:     "Shipped",
  delivered:   "Delivered",
  inspecting:  "Inspection",
  completed:   "Completed",
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = AdminService.subscribeToDoc("orders", params.id, snap => {
      if (snap.exists()) setOrder({ id: snap.id, ...snap.data() })
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [params.id])

  if (loading) return (
    <div className="container flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (!order) return (
    <div className="container py-16 text-center">
      <p className="text-muted-foreground">Order not found.</p>
      <Button asChild variant="outline" className="mt-4">
        <Link href="/dashboard/buyer/orders">Back to Orders</Link>
      </Button>
    </div>
  )

  const currentStep  = STATUS_STEPS.indexOf(order.status)
  const canConfirm   = order.status === "delivered" && order.buyerId === user?.uid
  const canDispute   = ["escrow_held", "shipped", "delivered"].includes(order.status)
  const isComplete   = ["completed", "refunded"].includes(order.status)
  const isLogistics  = order.deliveryMethod === "zamorax_logistics"
  const isFBZ        = order.deliveryMethod === "fbz"

  return (
    <div className="container py-8 max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-heading font-bold truncate">{order.itemTitle || "Order"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Order #{order.id.slice(0, 8).toUpperCase()}</p>
          {/* Delivery method badge */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {isLogistics && (
              <Badge className="bg-primary/10 text-primary text-xs flex items-center gap-1">
                <Package className="h-3 w-3" /> Zamorax Logistics
              </Badge>
            )}
            {isFBZ && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">⚡ FBZ Express</Badge>
            )}
            {!isLogistics && !isFBZ && (
              <Badge variant="outline" className="text-xs">Safe Meetup</Badge>
            )}
          </div>
        </div>
        <Badge className={statusColors[order.status] || "bg-gray-100"}>
          {order.status?.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Shipment Tracker — ONLY for Zamorax Logistics orders */}
      {isLogistics && order.shipmentId && order.trackingCode && (
        <ShipmentTracker
          shipmentId={order.shipmentId}
          trackingCode={order.trackingCode}
        />
      )}

      {/* Standard progress (non-logistics) */}
      {!isLogistics && !["cancelled", "disputed"].includes(order.status) && (
        <Card>
          <CardHeader><CardTitle className="text-base">Order Progress</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-0">
              {STATUS_STEPS.map((step, i) => {
                const done   = i <= currentStep
                const active = i === currentStep
                return (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-center w-full">
                      <div className={`h-0.5 flex-1 ${i === 0 ? "invisible" : done ? "bg-primary" : "bg-muted"}`} />
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors
                        ${done ? "bg-primary border-primary text-white" : "border-muted bg-background text-muted-foreground"}`}>
                        {done ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
                      </div>
                      <div className={`h-0.5 flex-1 ${i === STATUS_STEPS.length - 1 ? "invisible" : done && i < currentStep ? "bg-primary" : "bg-muted"}`} />
                    </div>
                    <span className={`text-[10px] text-center leading-tight ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {stepLabels[step]}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dispute banner */}
      {order.status === "disputed" && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">This order is under dispute</p>
            <p className="text-xs text-red-600 mt-0.5">Our team will review and respond within 48 hours.</p>
          </div>
        </div>
      )}

      {/* Order Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Order Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Item</span>
            <span className="font-medium truncate ml-4">{order.itemTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="capitalize">{order.orderType || "purchase"}</span>
          </div>
          {order.orderType === "rental" && order.rentalStart && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rental Period</span>
              <span>{new Date(order.rentalStart).toLocaleDateString()} — {new Date(order.rentalEnd).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Date</span>
            <span>{order.createdAt?.toDate?.().toLocaleDateString() || "—"}</span>
          </div>
          {order.trackingCode && (
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Tracking</span>
              <span className="font-mono text-xs">{order.trackingCode}</span>
            </div>
          )}
          {isLogistics && order.deliveryFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Item Price</span>
            <span>{formatPrice(order.itemPrice || 0)}</span>
          </div>
          {order.platformFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="text-red-500">-{formatPrice(order.platformFee)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total Paid</span>
            <span>{formatPrice(order.totalAmount || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Escrow notice */}
      {order.status === "escrow_held" && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <ShieldCheck className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Your payment is safely held in escrow. Released to seller only after you confirm receipt.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {canConfirm && (
          <Button asChild className="w-full bg-primary text-white hover:bg-primary/90">
            <Link href={`/dashboard/buyer/orders/${order.id}/confirm`}>
              <CheckCircle className="h-4 w-4 mr-2" /> Confirm Delivery & Release Payment
            </Link>
          </Button>
        )}

        {/* Receipt download */}
        {isComplete && (
          <Button asChild variant="outline" className="w-full">
            <a href={`/api/receipts/${params.id}`} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-2" /> Download Receipt
            </a>
          </Button>
        )}

        {/* Open dispute */}
        {canDispute && (
          <Button asChild variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50">
            <Link href={`/dashboard/buyer/disputes/new?orderId=${params.id}`}>
              <AlertTriangle className="h-4 w-4 mr-2" /> Open a Dispute
            </Link>
          </Button>
        )}

        {order.chatId && (
          <Button asChild variant="ghost" className="w-full">
            <Link href={`/chat/${order.chatId}`}>
              <MessageSquare className="h-4 w-4 mr-2" /> Message Seller
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
