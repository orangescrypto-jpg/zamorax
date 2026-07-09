"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { DashboardSidebar } from "@/components/shared/DashboardSidebar"
import { useBuyerInboxCounts } from "@/hooks/useSellerInboxCounts"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ShoppingBag, Heart, User,
  MessageSquare, Tag, Bell, ShieldAlert,
  Settings, Search, RotateCcw, Gift,
} from "lucide-react"

function isActive(href: string, pathname: string) {
  if (href === "/dashboard/buyer") return pathname === href
  return pathname.startsWith(href)
}

function BuyerBottomNav() {
  const pathname = usePathname()
  const { unreadChats, pendingOffers } = useBuyerInboxCounts()

  const BOTTOM_NAV = [
    { label: "Home",    href: "/dashboard/buyer",        icon: LayoutDashboard, count: 0 },
    { label: "Orders",  href: "/dashboard/buyer/orders", icon: ShoppingBag,     count: 0 },
    { label: "Saved",   href: "/dashboard/buyer/saved",  icon: Heart,           count: 0 },
    { label: "Offers",  href: "/dashboard/buyer/offers", icon: Tag,             count: pendingOffers },
    { label: "Profile", href: "/dashboard/profile",      icon: User,            count: 0 },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex h-16 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      {BOTTOM_NAV.map(({ label, href, icon: Icon, count }) => {
        const active = isActive(href, pathname)
        return (
          <Link key={href} href={href} className={cn("relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors", active ? "text-primary" : "text-muted-foreground")}>
            <div className="relative">
              <Icon className="h-5 w-5" />
              {!!count && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  const { unreadChats, pendingOffers } = useBuyerInboxCounts()

  const NAV_ITEMS = [
    { label: "Dashboard",     href: "/dashboard/buyer",              icon: LayoutDashboard },
    { label: "Orders",        href: "/dashboard/buyer/orders",       icon: ShoppingBag },
    { label: "Saved Items",   href: "/dashboard/buyer/saved",        icon: Heart },
    { label: "Offers",        href: "/dashboard/buyer/offers",       icon: Tag,
      ...(pendingOffers > 0 ? { badge: pendingOffers > 9 ? "9+" : String(pendingOffers), badgeColor: "bg-red-500" } : {}) },
    { label: "Search Alerts", href: "/dashboard/buyer/alerts",       icon: Search },
    { label: "Returns",       href: "/dashboard/buyer/returns",      icon: RotateCcw },
    { label: "Disputes",      href: "/dashboard/buyer/disputes/new", icon: ShieldAlert },
    { label: "Refer & Earn",  href: "/dashboard/referrals",          icon: Gift },
    { label: "Messages",      href: "/chat",                         icon: MessageSquare,
      ...(unreadChats > 0 ? { badge: unreadChats > 9 ? "9+" : String(unreadChats), badgeColor: "bg-red-500" } : {}) },
    { label: "Notifications", href: "/notifications",                icon: Bell },
    { label: "Profile",       href: "/dashboard/profile",            icon: User },
    { label: "Settings",      href: "/dashboard/buyer/settings",     icon: Settings },
  ]

  return (
    // admin + moderator are allowed so they can view their own purchases
    // (same pattern as seller layout which also grants buyer route access)
    <RoleGuard allowedRoles={["buyer", "seller", "both", "moderator", "admin"]}>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar navItems={NAV_ITEMS} role="Buyer" roleColor="bg-blue-600" isActive={isActive} />
        <div className="flex-1 min-w-0">
          <main className="pb-20 md:pb-0">{children}</main>
        </div>
      </div>
      <BuyerBottomNav />
    </RoleGuard>
  )
}
