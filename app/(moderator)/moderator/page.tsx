"use client"

import {AdminService, onSnapshot, where, query} from "@/src/services"
// app/(moderator)/moderator/page.tsx
// UPDATED: Adds Logistics section — disputes, stale shipments, flagged ZLAs, pending applications

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ListChecks, ShieldAlert, ShieldCheck, ArrowUpRight,
  Loader2, Flag, Bot, MessageSquare, Package,
  Clock, Truck, Users, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function ModeratorOverviewPage() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({
    // Existing
    listings: 0, disputes: 0, verifications: 0,
    reports: 0, autoResolvedToday: 0, pendingQnA: 0,
    // NEW: Logistics
    logisticsDisputes: 0,
    staleShipments: 0,
    flaggedZLAs: 0,
    pendingZLAApplications: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const LOGISTICS_REASONS = [
      "parcel_not_received", "wrong_item_delivered",
      "item_damaged_in_transit", "parcel_lost", "delayed_delivery",
    ]

    let resolved = 0
    const done = () => { resolved++; if (resolved >= 6) setLoading(false) }

    const unsubs = [
      // Existing
      onSnapshot(AdminService._ref_("listings", [where("status", "==", "pending")]),
        s => { setCounts(c => ({ ...c, listings: s.size })); done() }, () => done()),

      onSnapshot(AdminService._ref_("disputes", [where("status", "==", "open")]),
        s => { setCounts(c => ({ ...c, disputes: s.size })); done() }, () => done()),

      onSnapshot(AdminService._ref_("verificationRequests", [where("status", "==", "pending")]),
        s => { setCounts(c => ({ ...c, verifications: s.size })); done() }, () => done()),

      onSnapshot(AdminService._ref_("listingReports", [where("status", "==", "pending")]),
        s => setCounts(c => ({ ...c, reports: s.size })), () => {}),

      AdminService.subscribeToCollection("disputes", s => setCounts(c => ({ ...c, autoResolvedToday: s.size })), [where("autoResolvedAt", ">=", todayStart)]),

      onSnapshot(AdminService._ref_("listingQnA", [where("answer", "==", null)]),
        s => setCounts(c => ({ ...c, pendingQnA: s.size })), () => {}),

      // ── NEW: Logistics counts ─────────────────────────────────────────────
      // Logistics disputes (open)
      onSnapshot(
        AdminService._ref_("disputes", [where("status", "in", ["open", "investigating"])]),
        s => {
          const logistic = s.docs.filter(d =>
            LOGISTICS_REASONS.includes(d.reason) ||
            d.shipmentId ||
            d.deliveryMethod === "zamorax_logistics"
          ).length
          setCounts(c => ({ ...c, logisticsDisputes: logistic })); done()
        }, () => done()
      ),

      // Flagged ZLAs
      onSnapshot(AdminService._ref_("agentLocations", [where("isFlagged", "==", true)]),
        s => { setCounts(c => ({ ...c, flaggedZLAs: s.size })); done() }, () => done()),

      // Pending ZLA applications
      onSnapshot(AdminService._ref_("zlaApplications", [where("status", "==", "pending")]),
        s => { setCounts(c => ({ ...c, pendingZLAApplications: s.size })); done() }, () => done()),

      // Stale shipments (48h+) — one-time load
      (() => {
        AdminService._ref_("shipments", [where("status", "in", ["awaiting_dropoff", "dropped_off", "in_transit", "at_destination_agent"])]).then(docs => {
          const stale = docs.filter(d => {
            const upd = d.updatedAt?.toDate?.() || d.createdAt?.toDate?.()
            return upd && upd < staleThreshold
          }).length
          setCounts(c => ({ ...c, staleShipments: stale }))
        }).catch(() => {})
        return () => {}
      })(),
    ]

    return () => unsubs.forEach(u => typeof u === "function" && u())
  }, [])

  const primaryCards = [
    {
      label: "Listings to Review", value: counts.listings,
      href: "/moderator/listings", icon: <ListChecks className="h-5 w-5" />,
      color: "text-amber-600 bg-amber-50", urgent: counts.listings > 10 },
    {
      label: "Open Disputes", value: counts.disputes,
      href: "/moderator/disputes", icon: <ShieldAlert className="h-5 w-5" />,
      color: "text-red-600 bg-red-50", urgent: counts.disputes > 0 },
    {
      label: "Verifications", value: counts.verifications,
      href: "/moderator/verifications", icon: <ShieldCheck className="h-5 w-5" />,
      color: "text-blue-600 bg-blue-50", urgent: false },
    {
      label: "Listing Reports", value: counts.reports,
      href: "/moderator/reports", icon: <Flag className="h-5 w-5" />,
      color: "text-rose-600 bg-rose-50", urgent: counts.reports > 0 },
  ]

  const logisticsCards = [
    {
      label: "Logistics Disputes", value: counts.logisticsDisputes,
      href: "/moderator/logistics/disputes", icon: <Package className="h-5 w-5" />,
      color: "text-primary bg-primary/10", urgent: counts.logisticsDisputes > 0 },
    {
      label: "Stale Shipments", value: counts.staleShipments,
      href: "/moderator/logistics/stale", icon: <Clock className="h-5 w-5" />,
      color: "text-amber-600 bg-amber-50", urgent: counts.staleShipments > 0 },
    {
      label: "Flagged ZLAs", value: counts.flaggedZLAs,
      href: "/moderator/logistics/zlas", icon: <Truck className="h-5 w-5" />,
      color: "text-red-600 bg-red-50", urgent: counts.flaggedZLAs > 0 },
    {
      label: "ZLA Applications", value: counts.pendingZLAApplications,
      href: "/moderator/logistics/applications", icon: <Users className="h-5 w-5" />,
      color: "text-emerald-600 bg-emerald-50", urgent: counts.pendingZLAApplications > 0 },
  ]

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  const StatCard = ({ card }: { card: typeof primaryCards[0] }) => (
    <Link href={card.href}>
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${card.urgent ? "border-red-200" : ""}`}>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className={`p-2.5 rounded-xl w-fit ${card.color}`}>{card.icon}</div>
          <div>
            <p className="text-xs text-muted-foreground leading-tight">{card.label}</p>
            <p className="text-3xl font-bold">{card.value}</p>
          </div>
          <div className="flex items-center justify-between">
            {card.urgent && card.value > 0
              ? <Badge className="bg-red-100 text-red-700 text-[10px]">Needs attention</Badge>
              : <span />
            }
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  return (
    <div className="container py-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold">Moderator Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome, {user?.fullName}. Here's what needs attention.
        </p>
      </div>

      {/* Primary queues */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Platform</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {primaryCards.map(card => <StatCard key={card.label} card={card} />)}
        </div>
      </div>

      {/* Logistics queues — NEW */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Logistics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {logisticsCards.map(card => <StatCard key={card.label} card={card} />)}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100">
              <Bot className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-emerald-700 font-medium">Auto-resolved today</p>
              <p className="text-2xl font-bold text-emerald-800">{counts.autoResolvedToday}</p>
              <p className="text-[10px] text-emerald-600">by rules engine</p>
            </div>
          </CardContent>
        </Card>

        <Link href="/moderator/listings">
          <Card className="bg-purple-50 border-purple-100 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-100">
                <MessageSquare className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <p className="text-xs text-purple-700 font-medium">Unanswered Q&A</p>
                <p className="text-2xl font-bold text-purple-800">{counts.pendingQnA}</p>
                <p className="text-[10px] text-purple-600">awaiting reply</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { href: "/moderator/listings",              label: "Review Listings",         badge: counts.listings },
          { href: "/moderator/disputes",              label: "Handle Disputes",         badge: counts.disputes },
          { href: "/moderator/verifications",         label: "Verify Users",            badge: counts.verifications },
          { href: "/moderator/reports",               label: "Listing Reports",         badge: counts.reports },
          { href: "/moderator/logistics/disputes",    label: "Logistics Disputes",      badge: counts.logisticsDisputes },
          { href: "/moderator/logistics/stale",       label: "Stale Shipments",         badge: counts.staleShipments },
          { href: "/moderator/logistics/zlas",        label: "ZLA Monitor",             badge: counts.flaggedZLAs },
          { href: "/moderator/logistics/applications",label: "ZLA Applications",        badge: counts.pendingZLAApplications },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
          >
            {item.label}
            <div className="flex items-center gap-2">
              {item.badge > 0 && (
                <Badge className="bg-red-500 text-white text-[10px] h-5 px-1.5">{item.badge}</Badge>
              )}
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>

      {/* Scope reminder */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
        <p className="font-semibold">⚖️ Moderator Scope</p>
        <p>Listings, disputes, verifications, listing reports, logistics disputes, stale shipments, ZLA monitoring and pre-screening.</p>
        <p className="font-medium">Admin only: Final ZLA approval, deactivate ZLA permanently, change fees, process payouts, ban users.</p>
      </div>
    </div>
  )
}
