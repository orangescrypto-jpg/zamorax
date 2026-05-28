"use client"

import {ReferralsService, query, onSnapshot, where, serverTimestamp} from "@/src/services"

import {AdminService} from "@/src/services"
// app/(public)/dashboard/zla/page.tsx
// NEW: Zamorax Logistics Agent (ZLA) dashboard — completely separate from referral agent

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { SHIPMENT_STATUS_CONFIG, type ZamoraxShipment, type ShipmentStatus } from "@/src/types"
import { formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Package, ScanLine, Loader2, Wallet, CheckCircle2,
  Truck, MapPin, Clock, ArrowRight, Gift } from "lucide-react"
import Link from "next/link"

export default function ZLADashboardPage() {
  const { user }   = useAuth()
  const { toast }  = useToast()

  const [agentProfile, setAgentProfile] = useState<any>(null)
  const [hasApplied, setHasApplied]     = useState(false)
  const [wallet, setWallet]             = useState({ balance: 0, totalEarned: 0 })
  const [parcels, setParcels]           = useState<ZamoraxShipment[]>([])
  const [history, setHistory]           = useState<ZamoraxShipment[]>([])
  const [earnings, setEarnings]         = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [zlaTotals, setZlaTotals]       = useState({ received: 0, dispatched: 0, delivered: 0 })

  // Scan dialog
  const [scanOpen, setScanOpen]       = useState(false)
  const [scanCode, setScanCode]       = useState("")
  const [scanResult, setScanResult]   = useState<ZamoraxShipment | null>(null)
  const [scanning, setScanning]       = useState(false)
  const [processing, setProcessing]   = useState(false)

  // Live commission rates from Firestore
  const [rates, setRates] = useState({
    parcelReceivedKobo:   20000,  // ₦200
    parcelDispatchedKobo: 15000,  // ₦150
    parcelDeliveredKobo:  30000,  // ₦300
    doorstepBonusKobo:    10000,  // ₦100
  })

  useEffect(() => {
    if (!user?.uid) return

    // Load rates from Firestore
    AdminService.getDoc("config", "platform").then(docs => {
      if (snap.exists()) {
        const d = snap.data()
        setRates(r => ({
          parcelReceivedKobo:   d.zlaParcelReceivedKobo   ?? r.parcelReceivedKobo,
          parcelDispatchedKobo: d.zlaParcelDispatchedKobo ?? r.parcelDispatchedKobo,
          parcelDeliveredKobo:  d.zlaParcelDeliveredKobo  ?? r.parcelDeliveredKobo,
          doorstepBonusKobo:    d.zlaDoorstepBonusKobo    ?? r.doorstepBonusKobo }))
      }
    })

    // Run critical queries in parallel — only set loading=false when both finish
    Promise.all([
      AdminService._ref_("agentLocations", [where("agentUserId", "==", user.uid)]),
      AdminService._ref_("zlaApplications", [where("userId", "==", user.uid)]),
    ]).then(([agentSnap, appSnap]) => {
      if (!agentSnap.empty) setAgentProfile({ id: agentSnap.docs[0].id, ...agentSnap.docs[0].data() })
      if (!appSnap.empty)   setHasApplied(true)
      setLoading(false)
    }).catch(() => setLoading(false))

    // Non-critical — load in background
    getLogisticsAgentWallet(user.uid).then(w => setWallet(w as AgentWallet))
    AdminService._ref_("logisticsAgentWallets/" + user.uid, "transactions")
      .then(docs => setEarnings(docs.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [user?.uid])

  // Real-time active parcels
  useEffect(() => {
    if (!agentProfile?.id) return

    const activeQ = AdminService._ref_("shipments", [where("currentAgentId", "==", agentProfile.id)])
    const histQ = AdminService._ref_("shipments", [where("destinationAgentId", "==", agentProfile.id)])

    const u1 = onSnapshot(activeQ, docs => {
      setParcels(docs.docs.map(d => ({ id: d.id, ...d.data() } as ZamoraxShipment)))
    })
    const u2 = onSnapshot(histQ, docs => {
      const delivered = docs
        .docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.status === "delivered")
      setHistory(delivered)
      setZlaTotals(t => ({ ...t, delivered: delivered.length }))
    })
    return () => { u1(); u2() }
  }, [agentProfile?.id])

  const handleScan = async () => {
    if (!scanCode.trim()) return
    setScanning(true)
    try {)
      const snap = await AdminService.getCollection("shipments", [where("trackingCode", "==", scanCode.trim().toUpperCase())])
      docs.length === 0
        ? toast({ title: "Code not found", variant: "destructive" })
        : setScanResult({ id: docs[0].id, ...docs[0].data() } as ZamoraxShipment)
    } catch { toast({ title: "Scan error", variant: "destructive" }) }
    finally { setScanning(false) }
  }

  const handleAction = async (
    shipment: ZamoraxShipment,
    newStatus: ShipmentStatus,
    note: string,
    commissionType: "parcel_received" | "parcel_dispatched" | "parcel_delivered" | "doorstep_bonus",
    commissionKobo: number
  ) => {
    if (!agentProfile || !user?.uid) return
    setProcessing(true)
    try {)
      const event = {
        status:     newStatus,
        agentId:    agentProfile.id,
        agentName:  agentProfile.name,
        note,
        timestamp:  new Date().toISOString(),
        scannedBy:  user.uid }

      const isLeaving = newStatus === "in_transit"

      await AdminService.updateDoc("shipments", shipment.id, {
        status:           newStatus,
        currentAgentId:   isLeaving ? null : agentProfile.id,
        currentAgentName: isLeaving ? null : agentProfile.name,
        timeline:         [...(shipment.timeline || []), event],
        ...(newStatus === "delivered" ? { deliveredAt: serverTimestamp() } : {}),
        updatedAt:        serverTimestamp() })

      // Update order if delivered
      if (newStatus === "delivered") {
        await AdminService.updateDoc("orders", shipment.orderId, {
          status: "delivered", deliveredAt: serverTimestamp(), updatedAt: serverTimestamp() })
        // Notify buyer
        await AdminService.addDoc("notifications", {
          userId: shipment.buyerId, type: "system",
          title: "📦 Your item has arrived!",
          body:  `"${shipment.listingTitle}" delivered. Confirm receipt to release payment.`,
          link:  `/dashboard/buyer/orders/${shipment.orderId}`,
          read: false, createdAt: serverTimestamp() })
      }

      if (newStatus === "at_destination_agent") {
        await AdminService.addDoc("notifications", {
          userId: shipment.buyerId, type: "system",
          title: "📍 Your parcel is ready for pickup!",
          body:  `"${shipment.listingTitle}" is at ${agentProfile.name}. Tracking: ${shipment.trackingCode}`,
          link:  `/dashboard/buyer/orders/${shipment.orderId}`,
          read: false, createdAt: serverTimestamp() })
      }

      // Credit ZLA wallet
      await ReferralsService.creditLogisticsAgent(agentProfile.id, user.uid, commissionKobo, commissionType, shipment.id)
      await ReferralsService.getLogisticsAgentWallet(user.uid).then(w => setWallet(w as AgentWallet))

      toast({ title: `Status updated! +${formatPrice(commissionKobo)} earned`, variant: "success" })
      setScanOpen(false); setScanCode(""); setScanResult(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(false) }
  }

  if (loading) return (
    <div className="flex h-60 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  // State 1: Not applied yet — redirect to apply page
  if (!agentProfile && !hasApplied) return (
    <div className="container max-w-md py-12 space-y-6">
      <div className="text-center space-y-3">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Package className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Become a Zamorax Logistics Agent</h1>
        <p className="text-muted-foreground text-sm">
          Earn ₦200–₦500 per parcel you receive, store, and dispatch from your location.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { amount: "₦200", label: "Receive parcel" },
          { amount: "₦150", label: "Dispatch" },
          { amount: "₦300", label: "Final delivery" },
        ].map(item => (
          <div key={item.label} className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-primary font-bold">{item.amount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <Button asChild className="w-full bg-primary text-white h-12 font-semibold">
        <Link href="/dashboard/zla/apply">
          <Package className="h-4 w-4 mr-2" /> Apply to Become a ZLA
        </Link>
      </Button>
      <p className="text-center text-xs text-muted-foreground">Applications reviewed within 48 hours.</p>
    </div>
  )

  // State 2: Applied but not yet approved
  if (!agentProfile && hasApplied) return (
    <div className="container max-w-md py-16 text-center space-y-5">
      <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
        <Clock className="h-10 w-10 text-amber-600" />
      </div>
      <h1 className="text-xl font-bold">Application Under Review</h1>
      <p className="text-muted-foreground text-sm">
        Your Zamorax Logistics Agent application has been submitted. We'll activate your dashboard within 48 hours.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        ✅ Application received — check back soon!
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard/agent"><Gift className="h-4 w-4 mr-2" /> Back to Referral Dashboard</Link>
      </Button>
    </div>
  )

  return (
    <main className="container max-w-lg py-6 pb-24 space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold">ZLA Dashboard</h1>
        <p className="text-sm text-muted-foreground font-medium">{agentProfile.name}</p>
        <p className="text-xs text-muted-foreground">{agentProfile.address} · {agentProfile.operatingHours}</p>
      </div>

      {/* Cross-link to referral */}
      <Link href="/dashboard/agent">
        <div className="flex items-center justify-between p-3 bg-muted/50 border rounded-xl hover:bg-muted transition-colors">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">View Referral Dashboard</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>

      {/* Logistics Wallet */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Logistics Earnings</p>
            <p className="text-3xl font-bold text-primary">{formatPrice(wallet.balance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total: {formatPrice(wallet.totalEarned)}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="border-primary text-primary">
            <Link href="/dashboard/zla/withdraw">
              <Wallet className="h-4 w-4 mr-1" /> Withdraw
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Live rates */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">💰 Your Commission Rates</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Receive parcel",   amount: rates.parcelReceivedKobo },
              { label: "Dispatch parcel",  amount: rates.parcelDispatchedKobo },
              { label: "Final delivery",   amount: rates.parcelDeliveredKobo },
              { label: "Doorstep bonus",   amount: rates.doorstepBonusKobo },
            ].map(r => (
              <div key={r.label} className="bg-muted/50 rounded-lg p-2.5 text-center">
                <p className="text-primary font-bold text-sm">{formatPrice(r.amount)}</p>
                <p className="text-xs text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Rates set by Zamorax admin · Updated in real-time</p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Active",    value: parcels.length,     icon: <Package className="h-4 w-4 text-primary" /> },
          { label: "Delivered", value: history.length,     icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
          { label: "Earned",    value: formatPrice(wallet.totalEarned), icon: <Wallet className="h-4 w-4 text-amber-500" /> },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-3 text-center">
            <div className="flex justify-center mb-1">{s.icon}</div>
            <p className="font-bold text-sm">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Scan button */}
      <Button
        className="w-full bg-primary text-white hover:bg-primary/90 h-12"
        onClick={() => setScanOpen(true)}
      >
        <ScanLine className="h-5 w-5 mr-2" /> Scan / Enter Tracking Code
      </Button>

      {/* Tabs: Active parcels + Earnings */}
      <Tabs defaultValue="parcels">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="parcels">
            Active Parcels
            {parcels.length > 0 && (
              <span className="ml-1.5 bg-primary text-white text-[10px] rounded-full px-1.5">{parcels.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
        </TabsList>

        <TabsContent value="parcels" className="mt-4 space-y-3">
          {parcels.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground text-sm">
              No parcels currently at your location.
            </div>
          ) : (
            parcels.map(p => {))
              const cfg = SHIPMENT_STATUS_CONFIG[p.status]
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.listingTitle}</p>
                        <p className="text-xs font-mono text-muted-foreground">{p.trackingCode}</p>
                        <p className="text-xs text-muted-foreground">For: {p.buyerName} · {p.buyerState}</p>
                      </div>
                      <Badge className={`${cfg.color} shrink-0 text-xs`}>{cfg.label}</Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {p.status === "dropped_off" && (
                        <Button size="sm" className="bg-primary text-white text-xs"
                          onClick={() => handleAction(p, "in_transit", `Dispatched from ${agentProfile.name}`, "parcel_dispatched", rates.parcelDispatchedKobo)}
                          disabled={processing}
                        >
                          <Truck className="h-3.5 w-3.5 mr-1" /> Dispatch (+{formatPrice(rates.parcelDispatchedKobo)})
                        </Button>
                      )}
                      {p.status === "in_transit" && (
                        <Button size="sm" className="bg-indigo-600 text-white text-xs"
                          onClick={() => handleAction(p, "at_destination_agent", `Arrived at ${agentProfile.name}`, "parcel_received", rates.parcelReceivedKobo)}
                          disabled={processing}
                        >
                          <MapPin className="h-3.5 w-3.5 mr-1" /> Mark Arrived (+{formatPrice(rates.parcelReceivedKobo)})
                        </Button>
                      )}
                      {p.status === "at_destination_agent" && p.deliveryType === "agent_pickup" && (
                        <Button size="sm" className="bg-emerald-600 text-white text-xs"
                          onClick={() => handleAction(p, "delivered", "Buyer collected from agent", "parcel_delivered", rates.parcelDeliveredKobo)}
                          disabled={processing}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Buyer Collected (+{formatPrice(rates.parcelDeliveredKobo)})
                        </Button>
                      )}
                      {p.status === "at_destination_agent" && p.deliveryType === "doorstep" && (
                        <Button size="sm" className="bg-cyan-600 text-white text-xs"
                          onClick={() => handleAction(p, "out_for_delivery", "Out for doorstep delivery", "parcel_dispatched", rates.parcelDispatchedKobo)}
                          disabled={processing}
                        >
                          <Truck className="h-3.5 w-3.5 mr-1" /> Out for Delivery
                        </Button>
                      )}
                      {p.status === "out_for_delivery" && (
                        <Button size="sm" className="bg-emerald-600 text-white text-xs"
                          onClick={() => handleAction(p, "delivered", "Delivered to buyer address", "parcel_delivered", rates.parcelDeliveredKobo + rates.doorstepBonusKobo)}
                          disabled={processing}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Delivered (+{formatPrice(rates.parcelDeliveredKobo + rates.doorstepBonusKobo)})
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="earnings" className="mt-4 space-y-2">
          {earnings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-xl">
              No earnings yet. Start scanning parcels to earn.
            </div>
          ) : (
            earnings.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium capitalize">{e.reason?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.createdAt?.toDate ? formatDistanceToNow(e.createdAt.toDate(), { addSuffix: true }) : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-600">+{formatPrice(e.amount)}</p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Scan dialog */}
      <Dialog open={scanOpen} onOpenChange={v => { setScanOpen(v); setScanCode(""); setScanResult(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-primary" /> Scan Parcel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. ZML-ABC12345"
                value={scanCode}
                onChange={e => setScanCode(e.target.value.toUpperCase())}
                className="font-mono"
                onKeyDown={e => e.key === "Enter" && handleScan()}
              />
              <Button onClick={handleScan} disabled={scanning || !scanCode.trim()}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
              </Button>
            </div>

            {scanResult && (() => {)))
              const cfg = SHIPMENT_STATUS_CONFIG[scanResult.status]
              return (
                <div className="space-y-3">
                  <Card>
                    <CardContent className="p-3 space-y-1">
                      <p className="font-semibold text-sm">{scanResult.listingTitle}</p>
                      <p className="text-xs text-muted-foreground">From: {scanResult.sellerName}</p>
                      <p className="text-xs text-muted-foreground">To: {scanResult.buyerName} · {scanResult.buyerState}</p>
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </CardContent>
                  </Card>
                  <div className="space-y-2">
                    {scanResult.status === "awaiting_dropoff" && (
                      <Button className="w-full bg-blue-600 text-white"
                        onClick={() => handleAction(scanResult, "dropped_off", `Received at ${agentProfile.name}`, "parcel_received", rates.parcelReceivedKobo)}
                        disabled={processing}
                      >
                        <Package className="h-4 w-4 mr-2" /> Confirm Received from Seller (+{formatPrice(rates.parcelReceivedKobo)})
                      </Button>
                    )}
                    {scanResult.status === "in_transit" && (
                      <Button className="w-full bg-indigo-600 text-white"
                        onClick={() => handleAction(scanResult, "at_destination_agent", `Arrived at ${agentProfile.name}`, "parcel_received", rates.parcelReceivedKobo)}
                        disabled={processing}
                      >
                        <MapPin className="h-4 w-4 mr-2" /> Mark Arrived Here (+{formatPrice(rates.parcelReceivedKobo)})
                      </Button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
