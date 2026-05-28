"use client"

import { AdminService , where , serverTimestamp } from "@/src/services"
// app/(moderator)/moderator/logistics/stale/page.tsx
// Shows all shipments stuck without movement for too long + nudge actions

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { SHIPMENT_STATUS_CONFIG, type ZamoraxShipment } from "@/src/types"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addDoc } from "@/src/services"
import {
  Clock, Loader2, Bell, Package, Truck,
  MapPin, RefreshCw, AlertTriangle,
} from "lucide-react"

type StaleShipment = ZamoraxShipment & { hoursSinceUpdate: number }

const STALE_THRESHOLDS = [
  { label: "24+ hours",  value: 24  },
  { label: "48+ hours",  value: 48  },
  { label: "72+ hours",  value: 72  },
  { label: "7+ days",    value: 168 },
]

const STALE_STATUSES = [
  "awaiting_dropoff",
  "dropped_off",
  "in_transit",
  "at_destination_agent",
  "out_for_delivery",
]

const ZLA_STATUSES = [
  "dropped_off",
  "in_transit",
  "at_destination_agent",
  "out_for_delivery",
]

export default function ModeratorStaleShipmentsPage() {
  const { user }  = useAuth()
  const { toast } = useToast()

  const [shipments, setShipments] = useState<StaleShipment[]>([])
  const [loading, setLoading]     = useState(true)
  const [threshold, setThreshold] = useState("48")
  const [nudging, setNudging]     = useState<string | null>(null)

  const loadStale = async (hours: number) => {
    setLoading(true)
    try {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
      const staleQuery = [where("status", "in", STALE_STATUSES)]
      const snap = await AdminService.getCollection("shipments", staleQuery)

      const stale: StaleShipment[] = []
      snap.forEach(d => {
        const data = d.data() as ZamoraxShipment
        const updatedAt = (data.updatedAt as any)?.toDate?.() || (data.createdAt as any)?.toDate?.()
        if (updatedAt && updatedAt < cutoff) {
          const hoursSinceUpdate = Math.floor(
            (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60)
          )
          stale.push({ ...data, id: d.id, hoursSinceUpdate })
        }
      })

      // Sort by most stale first
      stale.sort((a, b) => b.hoursSinceUpdate - a.hoursSinceUpdate)
      setShipments(stale)
    } catch {
      toast({ title: "Error loading stale shipments", variant: "destructive" })
    } finally { setLoading(false) }
  }

  useEffect(() => { loadStale(parseInt(threshold)) }, [threshold])

  const nudgeSeller = async (shipment: StaleShipment) => {
    setNudging(shipment.id)
    try {
      const waitingAt = shipment.status === "awaiting_dropoff" ? "drop-off" : "transit"
      const sellerBody = (
        `Your item "${shipment.listingTitle}" (${shipment.trackingCode}) ` +
        `has been waiting at "${waitingAt}" for ${shipment.hoursSinceUpdate} hours. ` +
        `Please take action.`
      )
      await AdminService.addDoc("notifications", {
        userId:    shipment.sellerId,
        type:      "system",
        title:     "⏰ Action needed on your order",
        body:      sellerBody,
        link:      `/dashboard/seller/orders/${shipment.orderId}`,
        read:      false,
        createdAt: serverTimestamp(),
      })
      toast({ title: "Seller nudged!", description: "Notification sent to seller.", variant: "success" })
    } catch {
      toast({ title: "Error sending nudge", variant: "destructive" })
    } finally { setNudging(null) }
  }

  const nudgeZLA = async (shipment: StaleShipment) => {
    if (!shipment.currentAgentId) {
      toast({ title: "No agent assigned to this parcel yet", variant: "destructive" })
      return
    }
    setNudging(shipment.id + "-zla")
    try {
      // Get agent user ID
      const agentQuery = [where("__name__", "==", shipment.currentAgentId)]
      const agentSnap = await AdminService.getCollection("agentLocations", agentQuery)
      const agentUserId = (agentSnap[0] as Record<string, unknown>)?.agentUserId as string | undefined
      if (!agentUserId) {
        toast({ title: "Could not find agent contact", variant: "destructive" })
        setNudging(null)
        return
      }

      const agentBody = (
        `Parcel ${shipment.trackingCode} has been at your location for ` +
        `${shipment.hoursSinceUpdate} hours without a status update. ` +
        `Please update or dispatch immediately.`
      )
      await AdminService.addDoc("notifications", {
        userId:    agentUserId,
        type:      "system",
        title:     "⏰ Parcel needs attention!",
        body:      agentBody,
        link:      `/dashboard/zla`,
        read:      false,
        createdAt: serverTimestamp(),
      })
      toast({ title: "ZLA nudged!", description: "Notification sent to the agent.", variant: "success" })
    } catch {
      toast({ title: "Error sending nudge", variant: "destructive" })
    } finally { setNudging(null) }
  }

  const nudgeBuyer = async (shipment: StaleShipment) => {
    setNudging(shipment.id + "-buyer")
    try {
      const statusLabel = SHIPMENT_STATUS_CONFIG[shipment.status]?.label
      const buyerBody = (
        `Your order "${shipment.listingTitle}" (${shipment.trackingCode}) ` +
        `is currently ${statusLabel}. If you have concerns, please open a dispute.`
      )
      await AdminService.addDoc("notifications", {
        userId:    shipment.buyerId,
        type:      "system",
        title:     "📦 Your parcel update",
        body:      buyerBody,
        link:      `/dashboard/buyer/orders/${shipment.orderId}`,
        read:      false,
        createdAt: serverTimestamp(),
      })
      toast({ title: "Buyer notified", variant: "success" })
    } catch {
      toast({ title: "Error", variant: "destructive" })
    } finally { setNudging(null) }
  }

  const urgencyColor = (hours: number) => {
    if (hours >= 168) return "border-red-400 bg-red-50"
    if (hours >= 72)  return "border-orange-400 bg-orange-50"
    if (hours >= 48)  return "border-amber-300"
    return ""
  }

  const urgencyBadge = (hours: number) => {
    if (hours >= 168) return <Badge className="bg-red-600 text-white text-[10px]">7+ days 🚨</Badge>
    if (hours >= 72) {
      const days = Math.floor(hours / 24)
      return <Badge className="bg-orange-500 text-white text-[10px]">{days} days</Badge>
    }
    return <Badge className="bg-amber-100 text-amber-800 text-[10px]">{hours}h</Badge>
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Clock className="h-6 w-6 text-amber-500" /> Stale Shipments
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Parcels with no movement. Nudge sellers, ZLAs, or buyers to take action.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="w-44">
          <Select value={threshold} onValueChange={setThreshold}>
            <SelectTrigger>
              <SelectValue placeholder="Threshold" />
            </SelectTrigger>
            <SelectContent>
              {STALE_THRESHOLDS.map(t => (
                <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadStale(parseInt(threshold))}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${shipments.length} stale shipment${shipments.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : shipments.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center space-y-2">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/20" />
            <p className="font-semibold">No stale shipments</p>
            <p className="text-sm text-muted-foreground">
              All active shipments have been updated within the selected threshold.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shipments.map(s => {
            const cfg = SHIPMENT_STATUS_CONFIG[s.status]
            const hoursDisplay = s.hoursSinceUpdate >= 24
              ? `${Math.floor(s.hoursSinceUpdate / 24)} day${Math.floor(s.hoursSinceUpdate / 24) > 1 ? "s" : ""}`
              : `${s.hoursSinceUpdate} hours`
            const isZlaStatus = ZLA_STATUSES.includes(s.status)
            return (
              <Card key={s.id} className={`border-2 ${urgencyColor(s.hoursSinceUpdate)}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {urgencyBadge(s.hoursSinceUpdate)}
                        <p className="font-semibold text-sm truncate">{s.listingTitle}</p>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{s.trackingCode}</p>
                      <p className="text-xs text-muted-foreground">
                        Seller: {s.sellerName} → Buyer: {s.buyerName} ({s.buyerState})
                      </p>
                      {s.currentAgentName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Last at: {s.currentAgentName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        No update for <strong>{hoursDisplay}</strong>
                      </p>
                    </div>
                    <Badge className={`${cfg?.color} shrink-0 text-xs`}>{cfg?.label}</Badge>
                  </div>

                  {/* Context-aware nudge buttons based on status */}
                  <div className="flex gap-2 flex-wrap">
                    {/* Awaiting dropoff — nudge seller */}
                    {s.status === "awaiting_dropoff" && (
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => nudgeSeller(s)}
                        disabled={nudging === s.id}
                      >
                        {nudging === s.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><Bell className="h-3.5 w-3.5 mr-1" /> Nudge Seller</>
                        }
                      </Button>
                    )}

                    {/* In transit / dropped off — nudge ZLA */}
                    {isZlaStatus && (
                      <Button
                        size="sm"
                        className="bg-primary text-white hover:bg-primary/90"
                        onClick={() => nudgeZLA(s)}
                        disabled={nudging === s.id + "-zla"}
                      >
                        {nudging === s.id + "-zla"
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><Bell className="h-3.5 w-3.5 mr-1" /> Nudge ZLA</>
                        }
                      </Button>
                    )}

                    {/* Always — notify buyer */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => nudgeBuyer(s)}
                      disabled={nudging === s.id + "-buyer"}
                    >
                      {nudging === s.id + "-buyer"
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <><Bell className="h-3.5 w-3.5 mr-1" /> Update Buyer</>
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
