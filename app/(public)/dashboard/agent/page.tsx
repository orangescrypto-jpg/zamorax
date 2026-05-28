"use client"

import {ReferralsService, query, onSnapshot, where, serverTimestamp} from "@/src/services"

import {AdminService} from "@/src/services"
// app/(public)/dashboard/agent/page.tsx
// UPDATED: Full agent dashboard — referrals + Zamorax Logistics parcel management

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { SHIPMENT_STATUS_CONFIG, type ShipmentStatus, type ZamoraxShipment } from "@/src/types"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Copy, Share2, Users, Wallet, Gift, CheckCircle2, Loader2,
  ChevronRight, Package, QrCode, ScanLine, Truck, MapPin,
  ArrowRight, AlertTriangle } from "lucide-react"
import Link from "next/link"

const AGENT_PARCEL_STATUSES: ShipmentStatus[] = [
  "dropped_off", "in_transit", "at_destination_agent", "out_for_delivery",
]

export default function ZamoraxAgentPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [wallet, setWallet]       = useState<any>({ balance: 0, totalEarned: 0 })
  const [referrals, setReferrals] = useState<any[]>([])
  const [parcels, setParcels]     = useState<ZamoraxShipment[]>([])
  const [agentProfile, setAgentProfile] = useState<any>(null)
  const [loading, setLoading]     = useState(true)

  // Scan dialog
  const [scanOpen, setScanOpen]   = useState(false)
  const [scanCode, setScanCode]   = useState("")
  const [scanResult, setScanResult] = useState<ZamoraxShipment | null>(null)
  const [scanning, setScanning]   = useState(false)
  const [processing, setProcessing] = useState(false)

  const referralLink = user ? ReferralsService.getReferralLink(user.uid) : ""

  useEffect(() => {
    if (!user?.uid) return

    // Load agent profile from agentLocations
    AdminService.getCollection("agentLocations", where("agentUserId", "==", user.uid))
      .then(snap => { if (!snap.empty) setAgentProfile({ id: snap.docs[0].id, ...snap.docs[0].data() }) })

    // Load wallet + referrals
    Promise.all([
      getAgentWallet(user.uid).then(setWallet),
      AdminService.getCollection("referrals", where("referrerId", "==", user.uid))
        .then(s => setReferrals(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    ]).finally(() => setLoading(false))
  }, [user?.uid])

  useEffect(() => {
    if (!agentProfile?.id) return

    // Real-time parcels at or from this agent
    const q = AdminService._ref_("shipments", [where("currentAgentId", "==", agentProfile.id)])
    return onSnapshot(q, snap => {
      setParcels(snap.docs.map(d => ({ id: d.id, ...d.data() } as ZamoraxShipment)))
    })
  }, [agentProfile?.id])

  const copy  = () => { navigator.clipboard.writeText(referralLink); toast({ title: "Link copied!" }) }
  const share = () => {
    if (navigator.share) navigator.share({ title: "Join Zamorax", text: "Buy & sell safely. Use my link:", url: referralLink })
    else copy()
  }

  // Scan tracking code
  const handleScan = async () => {
    if (!scanCode.trim()) return
    setScanning(true)
    try {
      const snap = await AdminService.getCollection("shipments", [where("trackingCode", "==", scanCode.trim().toUpperCase())])
      if (snap.empty) {
        toast({ title: "Tracking code not found", variant: "destructive" })
        setScanResult(null)
      } else {
        setScanResult({ id: snap.docs[0].id, ...snap.docs[0].data() } as ZamoraxShipment)
      }
    } catch {
      toast({ title: "Error scanning code", variant: "destructive" })
    } finally { setScanning(false) }
  }

  // Update parcel status at this agent
  const handleUpdateParcel = async (shipment: ZamoraxShipment, newStatus: ShipmentStatus, note: string) => {
    if (!agentProfile?.id) return
    setProcessing(true)
    try {
      const newEvent = {
        status: newStatus,
        agentId: agentProfile.id,
        agentName: agentProfile.name,
        note,
        timestamp: new Date().toISOString(),
        scannedBy: user?.uid }

      await AdminService.updateDoc("shipments", shipment.id, {
        status: newStatus,
        currentAgentId:   newStatus === "in_transit" ? null : agentProfile.id,
        currentAgentName: newStatus === "in_transit" ? null : agentProfile.name,
        timeline: [...(shipment.timeline || []), newEvent],
        updatedAt: serverTimestamp() })

      // Update order status
      if (newStatus === "delivered") {
        await AdminService.updateDoc("orders", shipment.orderId, {
          status: "delivered",
          shipmentStatus: "delivered",
          deliveredAt: serverTimestamp(),
          updatedAt: serverTimestamp() })
        // Notify buyer to confirm
        await AdminService.addDoc("notifications", {
          userId: shipment.buyerId,
          type: "system",
          title: "📦 Your item has arrived!",
          body: `"${shipment.listingTitle}" has been delivered. Please confirm receipt to release payment.`,
          link: `/dashboard/buyer/orders/${shipment.orderId}`,
          read: false,
          createdAt: serverTimestamp() })
      } else if (newStatus === "at_destination_agent") {
        await AdminService.addDoc("notifications", {
          userId: shipment.buyerId,
          type: "system",
          title: "📍 Your parcel is at the pickup point!",
          body: `"${shipment.listingTitle}" is ready for pickup at ${agentProfile.name}. Tracking: ${shipment.trackingCode}`,
          link: `/dashboard/buyer/orders/${shipment.orderId}`,
          read: false,
          createdAt: serverTimestamp() })
      }

      toast({ title: "Parcel status updated! ✅", variant: "success" })
      setScanOpen(false)
      setScanCode("")
      setScanResult(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(false) }
  }

  const signups = referrals.length
  const orders  = referrals.filter(r => r.status === "ordered").length

  if (loading) return (
    <div className="flex h-60 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <main className="container max-w-lg py-6 pb-24 space-y-5">
      <div className="text-center space-y-1">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
          <Gift className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold">Zamorax Agent</h1>
        <p className="text-sm text-muted-foreground">
          {agentProfile ? `${agentProfile.name} · ${agentProfile.city}` : "Earn by referring & handling parcels"}
        </p>
      </div>

      {/* Wallet */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-3xl font-bold text-primary">{formatPrice(wallet.balance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total earned: {formatPrice(wallet.totalEarned)}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="border-primary text-primary">
            <Link href="/dashboard/agent/withdraw">
              <Wallet className="h-4 w-4 mr-1" /> Withdraw
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue={agentProfile ? "parcels" : "referrals"}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="parcels" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> Parcels
            {parcels.length > 0 && (
              <span className="bg-primary text-white text-[10px] rounded-full px-1.5">{parcels.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Referrals
          </TabsTrigger>
        </TabsList>

        {/* ── PARCELS TAB ── */}
        <TabsContent value="parcels" className="space-y-4 mt-4">
          {!agentProfile ? (
            <Card>
              <CardContent className="py-8 text-center space-y-4">
                <Package className="h-10 w-10 mx-auto text-primary/30" />
                <div>
                  <p className="font-semibold text-sm">Become a Zamorax Logistics Agent</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Earn ₦200–₦500 per parcel you receive, store, and dispatch from your location.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs max-w-xs mx-auto">
                  {[
                    { label: "Receive parcel", amount: "₦200" },
                    { label: "Dispatch",        amount: "₦150" },
                    { label: "Final delivery",  amount: "₦300" },
                  ].map(r => (
                    <div key={r.label} className="bg-primary/5 rounded-lg p-2">
                      <p className="font-bold text-primary">{r.amount}</p>
                      <p className="text-muted-foreground text-[10px] mt-0.5">{r.label}</p>
                    </div>
                  ))}
                </div>
                <Button asChild className="bg-primary text-white hover:bg-primary/90">
                  <Link href="/dashboard/zla/apply">
                    <Package className="h-4 w-4 mr-2" /> Apply to Become a ZLA
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">Applications reviewed within 48 hours.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Scan button */}
              <Button
                className="w-full bg-primary text-white hover:bg-primary/90 h-12"
                onClick={() => setScanOpen(true)}
              >
                <ScanLine className="h-5 w-5 mr-2" /> Scan / Enter Tracking Code
              </Button>

              {/* Active parcels */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Parcels in custody ({parcels.length})</p>
                {parcels.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-xl text-muted-foreground text-sm">
                    No parcels currently at your location.
                  </div>
                ) : (
                  parcels.map(p => {
                    const cfg = SHIPMENT_STATUS_CONFIG[p.status]
                    return (
                      <Card key={p.id}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{p.listingTitle}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.trackingCode}</p>
                              <p className="text-xs text-muted-foreground">For: {p.buyerName}</p>
                            </div>
                            <Badge className={`${cfg.color} shrink-0 text-xs`}>{cfg.label}</Badge>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            {p.status === "dropped_off" && (
                              <Button size="sm" className="bg-primary text-white"
                                onClick={() => handleUpdateParcel(p, "in_transit", "Dispatched to destination agent")}
                                disabled={processing}
                              >
                                <Truck className="h-3.5 w-3.5 mr-1" /> Dispatch
                              </Button>
                            )}
                            {p.status === "in_transit" && (
                              <Button size="sm" className="bg-indigo-600 text-white"
                                onClick={() => handleUpdateParcel(p, "at_destination_agent", `Arrived at ${agentProfile.name}`)}
                                disabled={processing}
                              >
                                <MapPin className="h-3.5 w-3.5 mr-1" /> Mark Arrived
                              </Button>
                            )}
                            {p.status === "at_destination_agent" && (
                              <>
                                {p.deliveryType === "doorstep" ? (
                                  <Button size="sm" className="bg-cyan-600 text-white"
                                    onClick={() => handleUpdateParcel(p, "out_for_delivery", "Agent going to deliver to buyer address")}
                                    disabled={processing}
                                  >
                                    <Truck className="h-3.5 w-3.5 mr-1" /> Out for Delivery
                                  </Button>
                                ) : (
                                  <Button size="sm" className="bg-emerald-600 text-white"
                                    onClick={() => handleUpdateParcel(p, "delivered", "Buyer collected from agent")}
                                    disabled={processing}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Buyer Collected
                                  </Button>
                                )}
                              </>
                            )}
                            {p.status === "out_for_delivery" && (
                              <Button size="sm" className="bg-emerald-600 text-white"
                                onClick={() => handleUpdateParcel(p, "delivered", "Delivered to buyer address")}
                                disabled={processing}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Delivered
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── REFERRALS TAB ── */}
        <TabsContent value="referrals" className="space-y-4 mt-4">
          {/* Reward rates */}
          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="p-4 text-center space-y-1">
              <p className="text-2xl font-bold text-primary">{formatPrice(REFERRAL_REWARDS.buyer_signup)}</p>
              <p className="text-xs text-muted-foreground">Per signup</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center space-y-1">
              <p className="text-2xl font-bold text-primary">{formatPrice(REFERRAL_REWARDS.first_order)}</p>
              <p className="text-xs text-muted-foreground">First order placed</p>
            </CardContent></Card>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Signups", value: signups,                       icon: <Users className="h-4 w-4 text-primary" /> },
              { label: "Orders",  value: orders,                        icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
              { label: "Earned",  value: formatPrice(wallet.totalEarned), icon: <Wallet className="h-4 w-4 text-amber-500" /> },
            ].map(s => (
              <Card key={s.label}><CardContent className="p-3 text-center">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className="font-bold text-sm">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent></Card>
            ))}
          </div>

          {/* Referral link */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Your Referral Link</p>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
              <p className="flex-1 text-xs truncate text-muted-foreground">{referralLink}</p>
              <button onClick={copy}><Copy className="h-4 w-4 text-muted-foreground hover:text-primary" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-2" />Copy</Button>
              <Button className="bg-primary text-white" onClick={share}><Share2 className="h-4 w-4 mr-2" />Share</Button>
            </div>
          </div>

          {/* History */}
          {referrals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Referral History</p>
              {referrals.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">User joined</p>
                    <p className="text-xs text-muted-foreground">{r.createdAt?.toDate?.().toLocaleDateString() || "Recently"}</p>
                  </div>
                  <Badge className={r.status === "ordered" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                    {r.status === "ordered" ? "Ordered ✓" : "Signed up"}
                  </Badge>
                </div>
              ))}
            </div>
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
                placeholder="Enter tracking code e.g. ZML-ABC12345"
                value={scanCode}
                onChange={e => setScanCode(e.target.value.toUpperCase())}
                className="font-mono"
                onKeyDown={e => e.key === "Enter" && handleScan()}
              />
              <Button onClick={handleScan} disabled={scanning || !scanCode.trim()}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
              </Button>
            </div>

            {scanResult && (
              <div className="space-y-3">
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <p className="font-semibold text-sm">{scanResult.listingTitle}</p>
                    <p className="text-xs text-muted-foreground">From: {scanResult.sellerName}</p>
                    <p className="text-xs text-muted-foreground">To: {scanResult.buyerName} · {scanResult.buyerState}</p>
                    <Badge className={SHIPMENT_STATUS_CONFIG[scanResult.status].color}>
                      {SHIPMENT_STATUS_CONFIG[scanResult.status].label}
                    </Badge>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Update status:</p>
                  {scanResult.status === "awaiting_dropoff" && (
                    <Button className="w-full bg-blue-600 text-white"
                      onClick={() => handleUpdateParcel(scanResult, "dropped_off", `Received at ${agentProfile?.name}`)}
                      disabled={processing}
                    >
                      <Package className="h-4 w-4 mr-2" /> Confirm Receipt from Seller
                    </Button>
                  )}
                  {scanResult.status === "in_transit" && (
                    <Button className="w-full bg-indigo-600 text-white"
                      onClick={() => handleUpdateParcel(scanResult, "at_destination_agent", `Arrived at ${agentProfile?.name}`)}
                      disabled={processing}
                    >
                      <MapPin className="h-4 w-4 mr-2" /> Mark as Arrived Here
                    </Button>
                  )}
                  {scanResult.status === "at_destination_agent" && (
                    <Button className="w-full bg-emerald-600 text-white"
                      onClick={() => handleUpdateParcel(scanResult, "delivered", "Buyer collected item")}
                      disabled={processing}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Buyer Collected
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScanOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
