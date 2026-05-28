"use client"

import {AdminService, where, query} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useAuthStore } from "@/store/authStore"
import { SellerStats } from "@/components/dashboard/SellerStats"
import { SellerRecentActivity } from "@/components/dashboard/SellerRecentActivity"
import { SellerAnalyticsDashboard } from "@/components/dashboard/SellerAnalyticsDashboard"
import { SellerOffersInbox } from "@/components/offers/SellerOffersInbox"
import { PlanLimitWarning } from "@/components/subscription/PlanLimitWarning"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import {
  Loader2, PlusCircle, Sparkles, Wallet, BarChart3,
  Tag, PackagePlus, Bell, Package2, ArrowUpRight, ShoppingBag } from "lucide-react"

function NewSellerOnboarding() {
  return (
    <Card className="border-2 border-dashed border-primary/40 bg-primary/5">
      <CardContent className="py-12 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <PackagePlus className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Welcome to your Seller Dashboard!</h2>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto">
            Post your first item to start selling to thousands of buyers on Zamorax.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-primary hover:bg-primary/90 text-white">
            <Link href="/dashboard/seller/post">
              <PlusCircle className="h-4 w-4 mr-2" /> Post Your First Listing
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/how-it-works">How It Works</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function OnboardingGate({ uid }: { uid: string }) {)
  const [hasListings, setHasListings] = useState<boolean | null>(null)
  useEffect(() => {
    getCountFromServer(AdminService._query_("listings", [where("sellerId", "==", uid)]))
      .then(docs => setHasListings(snap.data().count > 0))
      .catch(() => setHasListings(true))
  }, [uid])
  if (hasListings === false) return <NewSellerOnboarding />
  return null
}

function PushNotifBanner() {
  const { permission, requestPermission } = usePushNotifications()
  if (permission !== "default") return null
  return (
    <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm flex-1">
        <span className="font-semibold">Enable notifications</span> — get instant alerts for new orders, messages, and offers.
      </p>
      <Button size="sm" className="bg-primary text-white hover:bg-primary/90 shrink-0" onClick={requestPermission}>
        Enable
      </Button>
    </div>
  )
}

function SellerPurchasesTab() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const unsub = AdminService.subscribeToCollection(
      "orders",
      docs => { setOrders(docs.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      [where("buyerId", "==", user.uid)]
    )
    return unsub
  }, [user?.uid])

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />

  if (!orders.length) return (
    <Card>
      <CardContent className="py-12 text-center">
        <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium text-foreground">No purchases yet</p>
        <p className="text-xs text-muted-foreground mt-1">Items you buy will appear here</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/listings">Browse Listings</Link>
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{orders.length} purchase{orders.length !== 1 ? "s" : ""}</p>
      {orders.map((order: any) => (
        <Card key={order.id}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{order.listingTitle || "Order"}</p>
              <p className="text-xs text-muted-foreground">#{order.id.slice(-6).toUpperCase()} · {order.status}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">₦{(order.totalAmount || 0).toLocaleString()}</p>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs mt-1">
                <Link href={`/dashboard/buyer/orders`}><ArrowUpRight className="h-3 w-3 mr-1" />Track</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function SellerDashboardPage() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="container flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold">Seller Dashboard</h1>
          <p className="text-muted-foreground">Manage listings, track orders, and monitor your earnings.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-white">
          <Link href="/dashboard/seller/post">
            <PlusCircle className="h-4 w-4 mr-2" /> Post New Listing
          </Link>
        </Button>
      </div>

      {/* Push notification prompt */}
      <PushNotifBanner />

      <PlanLimitWarning />
      <SellerStats />

      {/* Onboarding for new sellers */}
      {user && <OnboardingGate uid={user.uid} />}

      {/* Quick action cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Wallet",      href: "/dashboard/seller/wallet",   icon: Wallet,   color: "bg-emerald-50 text-emerald-700", desc: "Earnings & payouts" },
          { label: "Bundle Deals",href: "/dashboard/seller/bundles",  icon: Package2, color: "bg-blue-50 text-blue-700",     desc: "Group item discounts" },
          { label: "Boost",       href: "/dashboard/seller/boost",    icon: Sparkles, color: "bg-amber-50 text-amber-700",   desc: "Increase visibility" },
          { label: "Flash Deals", href: "/dashboard/seller/flash-deals", icon: Tag,  color: "bg-red-50 text-red-600",       desc: "Limited-time offers" },
        ].map(({ label, href, icon: Icon, color, desc }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-4 space-y-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="mb-6 flex-wrap gap-1 h-auto">
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-1">
            <Tag className="h-3 w-3" /> Offers
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="boosts">Boosts</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="bundles">Bundles</TabsTrigger>
          <TabsTrigger value="purchases" className="flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" />My Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="activity"><SellerRecentActivity /></TabsContent>
        <TabsContent value="offers"><SellerOffersInbox /></TabsContent>
        <TabsContent value="analytics"><SellerAnalyticsDashboard /></TabsContent>

        <TabsContent value="boosts">
          <div className="p-6 border rounded-lg bg-muted/20 text-center space-y-3">
            <Sparkles className="h-10 w-10 mx-auto text-primary" />
            <h3 className="text-lg font-medium">Boost Your Listings</h3>
            <p className="text-muted-foreground">Increase visibility and get more buyers.</p>
            <Button asChild className="bg-primary text-white">
              <Link href="/dashboard/seller/boost">Open Boost Center</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="wallet">
          <div className="p-6 border rounded-lg bg-muted/20 text-center space-y-3">
            <Wallet className="h-10 w-10 mx-auto text-emerald-600" />
            <h3 className="text-lg font-medium">Seller Wallet</h3>
            <p className="text-muted-foreground">Track earnings and withdraw to your bank.</p>
            <Button asChild className="bg-primary text-white">
              <Link href="/dashboard/seller/wallet">
                <ArrowUpRight className="h-4 w-4 mr-2" /> Open Wallet
              </Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          <SellerPurchasesTab />
        </TabsContent>
        <TabsContent value="bundles">
          <div className="p-6 border rounded-lg bg-muted/20 text-center space-y-3">
            <Package2 className="h-10 w-10 mx-auto text-blue-600" />
            <h3 className="text-lg font-medium">Bundle Deals</h3>
            <p className="text-muted-foreground">Group your listings at a discount to sell faster.</p>
            <Button asChild className="bg-primary text-white">
              <Link href="/dashboard/seller/bundles">
                <Package2 className="h-4 w-4 mr-2" /> Manage Bundles
              </Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
