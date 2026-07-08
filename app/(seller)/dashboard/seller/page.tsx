"use client"

// app/(seller)/dashboard/seller/page.tsx
// Seller Overview — summary stats + quick actions + analytics dashboard.
// The Boost Center lives at /dashboard/seller/boost — this page was
// accidentally replaced with Boost Center content and is now restored.

import { AdminService, where, orderBy } from "@/src/services"
import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { SellerAnalyticsDashboard } from "@/components/dashboard/SellerAnalyticsDashboard"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import {
  Loader2, LayoutDashboard, Package, ShoppingBag,
  Wallet, Star, TrendingUp, ArrowUpRight, AlertCircle,
  CheckCircle2, Clock, Zap,
} from "lucide-react"
import Link from "next/link"

export default function SellerOverviewPage() {
  const user  = useAuthStore((s) => s.user)
  const uid   = user?.uid
  const { settings } = usePlatformSettings()

  const [orders,   setOrders]   = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!uid) return

    // Parallel real-time subscriptions
    const unsubOrders = AdminService.subscribeToCollection(
      "orders",
      (snap) => { setOrders(snap); setLoading(false) },
      [where("sellerId", "==", uid)]
    )

    const unsubListings = AdminService.subscribeToCollection(
      "listings",
      (snap) => setListings(snap),
      [where("sellerId", "==", uid)]
    )

    return () => { unsubOrders(); unsubListings() }
  }, [uid])

  // ── Derived stats ───────────────────────────────────────────────
  const completedOrders  = orders.filter(o => o.status === "completed")
  const pendingOrders    = orders.filter(o => ["pending", "paid", "shipped", "delivered", "inspecting"].includes(o.status))
  const totalEarnings    = completedOrders.reduce((sum, o) => sum + (o.sellerPayout || 0), 0)
  const activeListings   = listings.filter(l => l.status === "active").length
  const pendingListings  = listings.filter(l => l.status === "pending").length

  const analyticsTier: "basic" | "full" =
    user?.plan === "pro" ? "full" : "basic"

  // ── Quick-action cards ──────────────────────────────────────────
  const QUICK_LINKS = [
    { label: "My Listings",  href: "/dashboard/seller/listings", icon: Package,     color: "bg-blue-500/10 text-blue-600"    },
    { label: "Orders",       href: "/dashboard/seller/orders",   icon: ShoppingBag, color: "bg-orange-500/10 text-orange-600" },
    { label: "Earnings",     href: "/dashboard/seller/earnings",   icon: Wallet,      color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Boost Center", href: "/dashboard/seller/boost",    icon: Zap,         color: "bg-primary/10 text-primary"      },
  ]

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-8">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Welcome back{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's how your store is performing today.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 capitalize">
          {user?.plan ?? "free"} plan
        </Badge>
      </div>

      {/* ── Pending listings notice ─────────────────────────────── */}
      {pendingListings > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            <span className="font-semibold">{pendingListings} listing{pendingListings > 1 ? "s" : ""} pending review.</span>
            {" "}We'll notify you once approved.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0 text-xs">
            <Link href="/dashboard/seller/listings">View</Link>
          </Button>
        </div>
      )}

      {/* ── Summary stats ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Earnings",
            value: formatPrice(totalEarnings),
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
            sub: `${completedOrders.length} completed order${completedOrders.length !== 1 ? "s" : ""}`,
          },
          {
            label: "Active Listings",
            value: activeListings.toString(),
            icon: Package,
            color: "text-blue-600",
            bg: "bg-blue-500/10",
            sub: `${listings.length} total`,
          },
          {
            label: "Pending Orders",
            value: pendingOrders.length.toString(),
            icon: Clock,
            color: "text-orange-600",
            bg: "bg-orange-500/10",
            sub: pendingOrders.length > 0 ? "Needs attention" : "All clear",
          },
          {
            label: "Seller Rating",
            value: user?.sellerRating
              ? `${Number(user.sellerRating).toFixed(1)} ★`
              : "—",
            icon: Star,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            sub: `${user?.totalSales ?? 0} sale${(user?.totalSales ?? 0) !== 1 ? "s" : ""}`,
          },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <Card key={label}>
            <CardContent className="p-4 space-y-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="text-xl font-bold leading-none">{value}</p>
              <div>
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Quick actions ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_LINKS.map(({ label, href, icon: Icon, color }) => (
          <Link key={href} href={href}
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group">
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{label}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Recent orders ───────────────────────────────────────── */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Orders Needing Attention</h2>
            <Link href="/dashboard/seller/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {pendingOrders.slice(0, 3).map(order => (
              <Card key={order.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  {order.itemImage ? (
                    <img src={order.itemImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted shrink-0 flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{order.itemTitle}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(order.totalAmount || 0)}</p>
                  </div>
                  <Badge className={
                    order.status === "paid"       ? "bg-blue-100 text-blue-800" :
                    order.status === "shipped"    ? "bg-purple-100 text-purple-800" :
                    order.status === "delivered"  ? "bg-emerald-100 text-emerald-800" :
                    order.status === "inspecting" ? "bg-amber-100 text-amber-800" :
                    "bg-muted text-muted-foreground"
                  }>
                    {order.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Analytics ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Listing Analytics
          </h2>
          {analyticsTier === "basic" && (
            <Link href="/pricing" className="text-xs text-primary hover:underline flex items-center gap-1">
              Upgrade for full data <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <SellerAnalyticsDashboard tier={analyticsTier} />
      </div>

    </div>
  )
}
