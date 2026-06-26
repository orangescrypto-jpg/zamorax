"use client"
// app/(admin)/admin/overview/page.tsx
// Polls /api/admin/overview (server-side) instead of calling D1 directly in the browser.

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import {
  Users, ListChecks, ShieldAlert, Wallet,
  TrendingUp, Clock, BarChart3, ArrowUpRight,
  Loader2, AlertTriangle, Flag,
  Bot, Bell, Package2,
} from "lucide-react"
import Link from "next/link"

const POLL_INTERVAL = 30_000 // 30 s

type Stats = {
  totalUsers: number; newUsersToday: number; totalSellers: number; bannedUsers: number
  pendingListings: number; activeListings: number
  openDisputes: number; investigatingDisputes: number; autoResolvedToday: number
  totalGMV: number; totalCommission: number
  pendingWithdrawals: number; pendingWithdrawalAmount: number
  pendingPayouts: number; pendingPayoutAmount: number
  pendingReports: number
  activeSearchAlerts: number
  activeBundles: number
}

const DEFAULT_STATS: Stats = {
  totalUsers: 0, newUsersToday: 0, totalSellers: 0, bannedUsers: 0,
  pendingListings: 0, activeListings: 0,
  openDisputes: 0, investigatingDisputes: 0, autoResolvedToday: 0,
  totalGMV: 0, totalCommission: 0,
  pendingWithdrawals: 0, pendingWithdrawalAmount: 0,
  pendingPayouts: 0, pendingPayoutAmount: 0,
  pendingReports: 0,
  activeSearchAlerts: 0,
  activeBundles: 0,
}

export default function AdminOverviewPage() {
  const [stats, setStats]       = useState<Stats>(DEFAULT_STATS)
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store", credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStats(data.stats)
      setActivity(data.activity ?? [])
      setError(null)
    } catch (e: any) {
      setError(e.message ?? "Failed to load stats")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchStats])

  const statCards = [
    {
      label: "Total Users", value: stats.totalUsers, sub: `+${stats.newUsersToday} today`,
      icon: <Users className="h-5 w-5" />, color: "text-blue-600 bg-blue-50", href: "/admin/users",
    },
    {
      label: "Active Sellers", value: stats.totalSellers, sub: `${stats.bannedUsers} banned`,
      icon: <Users className="h-5 w-5" />, color: "text-purple-600 bg-purple-50", href: "/admin/users",
    },
    {
      label: "Pending Listings", value: stats.pendingListings, sub: `${stats.activeListings} live`,
      icon: <ListChecks className="h-5 w-5" />, color: "text-amber-600 bg-amber-50", href: "/admin/listings",
    },
    {
      label: "Open Disputes", value: stats.openDisputes, sub: `${stats.autoResolvedToday} auto-resolved today`,
      icon: <ShieldAlert className="h-5 w-5" />, color: "text-red-600 bg-red-50", href: "/admin/disputes",
    },
    {
      label: "Total GMV", value: formatPrice(stats.totalGMV), sub: `${formatPrice(stats.totalCommission)} commission`,
      icon: <TrendingUp className="h-5 w-5" />, color: "text-emerald-600 bg-emerald-50", href: "/admin/revenue",
    },
    {
      label: "Pending Withdrawals", value: stats.pendingWithdrawals, sub: formatPrice(stats.pendingWithdrawalAmount),
      icon: <Wallet className="h-5 w-5" />, color: "text-orange-600 bg-orange-50", href: "/admin/withdrawals",
    },
    {
      label: "Payout Requests", value: stats.pendingPayouts, sub: formatPrice(stats.pendingPayoutAmount),
      icon: <Wallet className="h-5 w-5" />, color: "text-teal-600 bg-teal-50", href: "/admin/payouts",
    },
    {
      label: "Listing Reports", value: stats.pendingReports, sub: "flagged by users",
      icon: <Flag className="h-5 w-5" />, color: "text-rose-600 bg-rose-50", href: "/moderator/reports",
    },
    {
      label: "Search Alerts", value: stats.activeSearchAlerts, sub: "active alerts",
      icon: <Bell className="h-5 w-5" />, color: "text-violet-600 bg-violet-50", href: "/admin/overview",
    },
    {
      label: "Active Bundles", value: stats.activeBundles, sub: "seller bundles live",
      icon: <Package2 className="h-5 w-5" />, color: "text-cyan-600 bg-cyan-50", href: "/admin/listings",
    },
  ]

  if (loading) return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Loading platform data...</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div className="container py-8">
      <h1 className="text-3xl font-heading font-bold">Admin Overview</h1>
      <div className="mt-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
        <span>Failed to load stats: {error}</span>
        <button onClick={fetchStats} className="ml-auto underline text-xs">Retry</button>
      </div>
    </div>
  )

  const typeIcon: Record<string, React.ReactNode> = {
    user:    <Users className="h-3.5 w-3.5" />,
    dispute: <ShieldAlert className="h-3.5 w-3.5" />,
    payout:  <Wallet className="h-3.5 w-3.5" />,
    listing: <ListChecks className="h-3.5 w-3.5" />,
  }
  const typeBg: Record<string, string> = {
    user: "bg-blue-500", dispute: "bg-red-500",
    payout: "bg-orange-500", listing: "bg-purple-500",
  }

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Live platform health at a glance.</p>
      </div>

      {/* Alert banners */}
      <div className="space-y-2">
        {stats.openDisputes > 0 && (
          <Link href="/admin/disputes" className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 hover:bg-red-100 transition-colors">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span><strong>{stats.openDisputes} open dispute{stats.openDisputes > 1 ? "s" : ""}</strong> need your attention.</span>
            <ArrowUpRight className="h-4 w-4 ml-auto" />
          </Link>
        )}
        {stats.pendingListings > 0 && (
          <Link href="/admin/listings" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition-colors">
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            <span><strong>{stats.pendingListings} listing{stats.pendingListings > 1 ? "s" : ""}</strong> waiting for moderation.</span>
            <ArrowUpRight className="h-4 w-4 ml-auto" />
          </Link>
        )}
        {stats.pendingWithdrawals > 0 && (
          <Link href="/admin/withdrawals" className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-800 hover:bg-orange-100 transition-colors">
            <Wallet className="h-4 w-4 shrink-0 text-orange-500" />
            <span><strong>{stats.pendingWithdrawals} withdrawal{stats.pendingWithdrawals > 1 ? "s" : ""}</strong> — {formatPrice(stats.pendingWithdrawalAmount)} to approve.</span>
            <ArrowUpRight className="h-4 w-4 ml-auto" />
          </Link>
        )}
        {stats.pendingPayouts > 0 && (
          <Link href="/admin/payouts" className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-800 hover:bg-teal-100 transition-colors">
            <Wallet className="h-4 w-4 shrink-0 text-teal-500" />
            <span><strong>{stats.pendingPayouts} payout request{stats.pendingPayouts > 1 ? "s" : ""}</strong> — {formatPrice(stats.pendingPayoutAmount)} to process.</span>
            <ArrowUpRight className="h-4 w-4 ml-auto" />
          </Link>
        )}
        {stats.pendingReports > 0 && (
          <Link href="/moderator/reports" className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-800 hover:bg-rose-100 transition-colors">
            <Flag className="h-4 w-4 shrink-0 text-rose-500" />
            <span><strong>{stats.pendingReports} listing report{stats.pendingReports > 1 ? "s" : ""}</strong> pending moderator review.</span>
            <ArrowUpRight className="h-4 w-4 ml-auto" />
          </Link>
        )}
        {stats.autoResolvedToday > 0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
            <Bot className="h-4 w-4 shrink-0 text-emerald-500" />
            <span><strong>{stats.autoResolvedToday} dispute{stats.autoResolvedToday > 1 ? "s" : ""}</strong> auto-resolved by the rules engine today.</span>
          </div>
        )}
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Link key={card.label} href={card.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2 rounded-xl ${card.color} shrink-0`}>{card.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground leading-tight">{card.label}</p>
                  <p className="text-xl font-bold mt-0.5 truncate">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.sub}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions + Recent activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {[
              { href: "/admin/listings",    icon: <ListChecks className="h-4 w-4" />,  label: "Review Listings",     badge: stats.pendingListings },
              { href: "/admin/disputes",    icon: <ShieldAlert className="h-4 w-4" />, label: "Resolve Disputes",    badge: stats.openDisputes },
              { href: "/admin/withdrawals", icon: <Wallet className="h-4 w-4" />,      label: "Approve Withdrawals", badge: stats.pendingWithdrawals },
              { href: "/admin/payouts",     icon: <Wallet className="h-4 w-4" />,      label: "Process Payouts",     badge: stats.pendingPayouts },
              { href: "/moderator/reports", icon: <Flag className="h-4 w-4" />,        label: "Review Reports",      badge: stats.pendingReports },
              { href: "/admin/users",       icon: <Users className="h-4 w-4" />,       label: "Manage Users",        badge: 0 },
              { href: "/admin/revenue",     icon: <BarChart3 className="h-4 w-4" />,   label: "Revenue Dashboard",   badge: 0 },
              { href: "/admin/settings",    icon: <BarChart3 className="h-4 w-4" />,   label: "Platform Settings",   badge: 0 },
            ].map((item: any) => (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-sm transition-colors">
                <span className="text-muted-foreground">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && <Badge variant="destructive" className="text-xs">{item.badge}</Badge>}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity yet.</p>
            ) : (
              activity.map((item, i) => (
                <div key={`${item.id}-${item.type}-${i}`} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs ${typeBg[item.type] || "bg-gray-400"}`}>
                    {typeIcon[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  {item.badge && (
                    <Badge variant="secondary" className="text-xs shrink-0 capitalize">{item.badge}</Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Health */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Platform Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Verified Sellers", value: stats.totalSellers, total: Math.max(stats.totalUsers, 1), color: "bg-green-500" },
              { label: "Active Listings",  value: stats.activeListings, total: Math.max(stats.activeListings + stats.pendingListings, 1), color: "bg-blue-500" },
              { label: "Open Disputes",    value: stats.openDisputes, total: Math.max(stats.openDisputes + 10, 10), color: "bg-red-500" },
              { label: "Active Bundles",   value: stats.activeBundles, total: Math.max(stats.activeBundles + 20, 20), color: "bg-cyan-500" },
            ].map(m => (
              <div key={m.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-semibold">{m.value}</span>
                </div>
                <div className="h-2 bg-muted rounded-full">
                  <div
                    className={`h-2 rounded-full ${m.color} transition-all`}
                    style={{ width: `${Math.min((m.value / m.total) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <p>Total GMV: <strong className="text-secondary">{formatPrice(stats.totalGMV)}</strong></p>
              <p>Commission earned: <strong className="text-primary">{formatPrice(stats.totalCommission)}</strong></p>
              <p>Search Alerts active: <strong>{stats.activeSearchAlerts}</strong></p>
              <p>Disputes auto-resolved today: <strong className="text-emerald-600">{stats.autoResolvedToday}</strong></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-primary" /> Admin Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/admin/listings/post", label: "Post a Listing",    sub: "Auto-approved",                    color: "bg-primary/10 text-primary" },
              { href: "/admin/listings",      label: "Review Listings",   sub: `${stats.pendingListings} pending`,  color: "bg-amber-50 text-amber-700" },
              { href: "/admin/disputes",      label: "Handle Disputes",   sub: `${stats.openDisputes} open`,        color: "bg-red-50 text-red-700" },
              { href: "/admin/payouts",       label: "Process Payouts",   sub: `${stats.pendingPayouts} pending`,   color: "bg-teal-50 text-teal-700" },
              { href: "/moderator/reports",   label: "Listing Reports",   sub: `${stats.pendingReports} flagged`,   color: "bg-rose-50 text-rose-700" },
              { href: "/admin/settings",      label: "Platform Settings", sub: "Fees, plans, boost pricing",        color: "bg-gray-50 text-gray-700" },
            ].map(s => (
              <Link key={s.href} href={s.href} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
