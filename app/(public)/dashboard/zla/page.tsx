"use client"

// app/(public)/dashboard/zla/page.tsx
// UPDATED: Summary view only — full dashboard lives on ZamoraxLogic.com
// Shows: agent status, active parcels count, earnings this month, link to ZamoraxLogic

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { AdminService, where } from "@/src/services"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Package, Wallet, ExternalLink, ArrowRight,
  Loader2, Clock, CheckCircle2, Gift, TrendingUp
} from "lucide-react"
import Link from "next/link"

const ZAMORAXLOGIC_URL = process.env.NEXT_PUBLIC_ZAMORAXLOGIC_URL || "https://zamoraxlogic.com"

export default function ZLADashboardPage() {
  const { user } = useAuth()

  const [loading, setLoading]           = useState(true)
  const [agentProfile, setAgentProfile] = useState<any>(null)
  const [hasApplied, setHasApplied]     = useState(false)
  const [summary, setSummary]           = useState({
    activeParcels:  0,
    deliveredTotal: 0,
    walletBalance:  0,
    totalEarned:    0,
  })

  useEffect(() => {
    if (!user?.uid) return

    Promise.all([
      AdminService.getCollection("agentLocations",  [where("agentUserId", "==", user.uid)]),
      AdminService.getCollection("zlaApplications", [where("userId",      "==", user.uid)]),
    ]).then(async ([agentDocs, appDocs]) => {
      if (agentDocs.length > 0) {
        const agent = agentDocs[0]
        setAgentProfile(agent)

        // Load summary data
        const [activeDocs, historyDocs, wallet] = await Promise.all([
          AdminService.getCollection("shipments", [where("currentAgentId", "==", agent.id)]),
          AdminService.getCollection("shipments", [
            where("destinationAgentId", "==", agent.id),
            where("status", "==", "delivered"),
          ]),
          AdminService.getDoc("logisticsAgentWallets", user.uid),
        ])

        setSummary({
          activeParcels:  activeDocs.length,
          deliveredTotal: historyDocs.length,
          walletBalance:  (wallet as any)?.balance    ?? 0,
          totalEarned:    (wallet as any)?.totalEarned ?? 0,
        })
      } else if (appDocs.length > 0) {
        setHasApplied(true)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.uid])

  const openZLADashboard = () => {
    window.open(`${ZAMORAXLOGIC_URL}/agent`, "_blank")
  }

  if (loading) return (
    <div className="flex h-60 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  // Not applied yet
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
          { amount: "₦200", label: "Receive" },
          { amount: "₦150", label: "Dispatch" },
          { amount: "₦300", label: "Deliver" },
        ].map((item: any) => (
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
      <p className="text-center text-xs text-muted-foreground">
        Applications reviewed within 48 hours.
      </p>
    </div>
  )

  // Applied but pending
  if (!agentProfile && hasApplied) return (
    <div className="container max-w-md py-16 text-center space-y-5">
      <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
        <Clock className="h-10 w-10 text-amber-600" />
      </div>
      <h1 className="text-xl font-bold">Application Under Review</h1>
      <p className="text-muted-foreground text-sm">
        Your ZLA application has been submitted. We'll activate your account within 48 hours.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        ✅ Application received — check back soon!
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard/agent">
          <Gift className="h-4 w-4 mr-2" /> Back to Referral Dashboard
        </Link>
      </Button>
    </div>
  )

  // Approved — show summary + link to ZamoraxLogic
  return (
    <main className="container max-w-lg py-6 pb-24 space-y-5">

      {/* Header */}
      <div className="text-center space-y-1">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold">ZLA Summary</h1>
        <p className="text-sm text-muted-foreground font-medium">{agentProfile.name}</p>
        <p className="text-xs text-muted-foreground">
          {agentProfile.address} · {agentProfile.operatingHours}
        </p>
        <Badge className="bg-emerald-100 text-emerald-800 mt-1">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Active Agent
        </Badge>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{summary.activeParcels}</p>
            <p className="text-xs text-muted-foreground">Active Parcels</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold">{summary.deliveredTotal}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wallet className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-primary">{formatPrice(summary.walletBalance)}</p>
            <p className="text-xs text-muted-foreground">Wallet Balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold">{formatPrice(summary.totalEarned)}</p>
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Main CTA — open full dashboard on ZamoraxLogic */}
      <Button
        className="w-full h-14 bg-primary text-white hover:bg-primary/90 font-semibold text-base"
        onClick={openZLADashboard}
      >
        <ExternalLink className="h-5 w-5 mr-2" />
        Open Full Agent Dashboard
        <ArrowRight className="h-5 w-5 ml-2" />
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Your full dashboard — scan parcels, manage deliveries, withdraw earnings — is on ZamoraxLogic.com.
        Opens in a new tab.
      </p>

      {/* Info card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold text-primary">On ZamoraxLogic.com you can:</p>
          {[
            "Scan and update parcel status",
            "See all active and delivered parcels",
            "View and withdraw earnings",
            "See live commission rates",
            "Access your full delivery history",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

    </main>
  )
}
