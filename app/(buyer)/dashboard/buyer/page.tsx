"use client"

import { useAuth } from "@/hooks/useAuth"
import { BuyerStats } from "@/components/dashboard/BuyerStats"
import { RecentOrders } from "@/components/dashboard/RecentOrders"
import { BuyerBadges } from "@/components/buyer/BuyerBadges"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import {
  Loader2, Heart, MessageSquare, Store, PackageSearch,
  ChevronRight, Bell, Search, ShieldCheck, Share2,
} from "lucide-react"

const QUICK_ACTIONS = [
  { label: "My Orders",     href: "/dashboard/buyer/orders",  icon: PackageSearch, color: "bg-blue-100 text-blue-600" },
  { label: "Saved Items",   href: "/dashboard/buyer/saved",   icon: Heart,         color: "bg-red-100 text-red-500" },
  { label: "Messages",      href: "/chat",                    icon: MessageSquare, color: "bg-purple-100 text-purple-600" },
  { label: "Search Alerts", href: "/dashboard/buyer/alerts",  icon: Bell,          color: "bg-amber-100 text-amber-600" },  // ← NEW
]

function PushNotifBanner() {
  const { permission, requestPermission } = usePushNotifications()
  if (permission !== "default") return null
  return (
    <div className="mx-4 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
      <Bell className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm flex-1">
        <span className="font-semibold">Stay in the loop</span> — get notified when orders update or saved items drop in price.
      </p>
      <Button size="sm" className="bg-primary text-white hover:bg-primary/90 shrink-0" onClick={requestPermission}>
        Enable
      </Button>
    </div>
  )
}

export default function BuyerDashboardPage() {
  const { user, loading, isSeller } = useAuth()

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="container pt-6 pb-4">
        <h1 className="text-2xl font-heading font-bold">
          Hey{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Track your orders and account activity.</p>

        {/* Buyer badges — shown right under name */}
        {user?.badges && user.badges.length > 0 && (
          <div className="mt-2">
            <BuyerBadges badges={user.badges} size="sm" />
          </div>
        )}
      </div>

      {/* Push notif prompt */}
      <PushNotifBanner />

      {/* Stats */}
      <div className="container mt-4">
        <BuyerStats />
      </div>

      {/* Sticky Quick Actions */}
      <div className="sticky top-16 z-20 bg-white border-y shadow-sm mt-4">
        <div className="grid grid-cols-4 divide-x">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon, color }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center justify-center gap-1 py-3 hover:bg-gray-50 transition active:bg-gray-100"
            >
              <div className={`p-2 rounded-full ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-medium text-center leading-tight px-0.5">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="container mt-6 space-y-5">
        <RecentOrders />

        {/* Feature cards grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Search Alerts card */}
          <Link href="/dashboard/buyer/alerts">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-amber-200">
              <CardContent className="p-4 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Search className="h-4 w-4 text-amber-700" />
                </div>
                <p className="text-sm font-semibold">Search Alerts</p>
                <p className="text-xs text-muted-foreground">Get notified when new listings match your saved searches.</p>
              </CardContent>
            </Card>
          </Link>

          {/* Saved & Share card */}
          <Link href="/dashboard/buyer/saved">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-red-100">
              <CardContent className="p-4 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <Share2 className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-sm font-semibold">Share Wishlist</p>
                <p className="text-xs text-muted-foreground">Send your saved items to friends and family.</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Badge progress card — shown if user has no badges yet */}
        {(!user?.badges || user.badges.length === 0) && (
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Earn your Verified Buyer badge</p>
                <p className="text-xs text-muted-foreground">Complete 5 orders to get your badge — sellers trust verified buyers more.</p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0 border-blue-300 text-blue-700">
                <Link href="/search">Shop Now <ChevronRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Become seller prompt */}
        {user && !isSeller() && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-secondary">Ready to sell on Zamorax?</p>
                <p className="text-xs text-muted-foreground">5 free listings to start</p>
              </div>
              <Button asChild size="sm" className="shrink-0 bg-primary text-white">
                <Link href="/dashboard/become-seller">
                  Start <ChevronRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
