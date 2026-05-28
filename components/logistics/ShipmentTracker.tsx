"use client"

import {AdminService, onSnapshot} from "@/src/services"
// components/logistics/ShipmentTracker.tsx
// Live tracking UI shown on buyer order detail page

import { useEffect, useState } from "react"
import { type ZamoraxShipment, SHIPMENT_STATUS_CONFIG } from "@/src/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Package, MapPin, Clock, CheckCircle, Truck,
  Loader2, Copy, ExternalLink,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/components/ui/use-toast"

const STATUS_ICONS: Record<string, React.ReactNode> = {
  awaiting_dropoff:     <Clock className="h-4 w-4" />,
  dropped_off:          <Package className="h-4 w-4" />,
  in_transit:           <Truck className="h-4 w-4" />,
  at_destination_agent: <MapPin className="h-4 w-4" />,
  out_for_delivery:     <Truck className="h-4 w-4" />,
  delivered:            <CheckCircle className="h-4 w-4" />,
  failed_delivery:      <Package className="h-4 w-4" />,
  returned:             <Package className="h-4 w-4" />,
}

const ALL_STATUSES = [
  "awaiting_dropoff",
  "dropped_off",
  "in_transit",
  "at_destination_agent",
  "out_for_delivery",
  "delivered",
]

export function ShipmentTracker({ shipmentId, trackingCode }: { shipmentId: string; trackingCode: string }) {
  const { toast } = useToast()
  const [shipment, setShipment] = useState<ZamoraxShipment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shipmentId) return
    return AdminService.subscribeToDoc("shipments", shipmentId, docs => {
        setShipment(snap.exists() ? { id: snap.id, ...snap.data() } as ZamoraxShipment : null)
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [shipmentId])

  const copy = () => {
    navigator.clipboard.writeText(trackingCode)
    toast({ title: "Tracking code copied!", variant: "success" })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )

  if (!shipment) return null

  const cfg = SHIPMENT_STATUS_CONFIG[shipment.status]
  const currentIdx = ALL_STATUSES.indexOf(shipment.status)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Zamorax Logistics
          </span>
          <Badge className={cfg.color}>{cfg.label}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Tracking code */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
          <p className="text-xs text-muted-foreground flex-1">
            Tracking: <span className="font-mono font-bold text-foreground text-sm">{trackingCode}</span>
          </p>
          <button onClick={copy} className="text-muted-foreground hover:text-primary transition-colors">
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-3">
          {ALL_STATUSES.map((status, i) => {
            const sCfg   = SHIPMENT_STATUS_CONFIG[status as keyof typeof SHIPMENT_STATUS_CONFIG]
            const done   = i < currentIdx
            const active = i === currentIdx
            const icon   = STATUS_ICONS[status]

            return (
              <div key={status} className="flex items-start gap-3">
                {/* Icon + line */}
                <div className="flex flex-col items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all
                    ${done   ? "bg-primary border-primary text-white"
                    : active ? "border-primary text-primary bg-primary/10"
                    :          "border-border text-muted-foreground bg-background"}
                  `}>
                    {done ? <CheckCircle className="h-4 w-4" /> : icon}
                  </div>
                  {i < ALL_STATUSES.length - 1 && (
                    <div className={`w-0.5 h-6 mt-1 ${done ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 pb-2">
                  <p className={`text-sm font-medium ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                    {sCfg.label}
                  </p>
                  {active && (
                    <p className="text-xs text-muted-foreground mt-0.5">{sCfg.description}</p>
                  )}
                  {/* Show timestamp from timeline */}
                  {(done || active) && shipment.timeline && (() => {
                    const event = [...shipment.timeline].reverse().find(e => e.status === status)
                    if (!event) return null
                    return (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.timestamp?.toDate
                          ? formatDistanceToNow(event.timestamp.toDate(), { addSuffix: true })
                          : ""}
                        {event.agentName ? ` · ${event.agentName}` : ""}
                      </p>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Destination agent info */}
        {shipment.status === "at_destination_agent" && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-primary">📦 Your parcel is ready for pickup!</p>
            <div className="text-sm space-y-1">
              <p className="font-medium">{shipment.destinationAgentName}</p>
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {shipment.currentAgentName}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Bring your tracking code or phone number to collect your item.
            </p>
          </div>
        )}

        {/* Estimated delivery */}
        {!["delivered", "returned", "failed_delivery"].includes(shipment.status) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Estimated delivery: <strong>{shipment.estimatedDeliveryDays} business day{shipment.estimatedDeliveryDays > 1 ? "s" : ""}</strong></span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
