"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { DashboardSidebar } from "@/components/shared/DashboardSidebar"
import { useSellerInboxCounts } from "@/hooks/useSellerInboxCounts"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Package, ShoppingBag, Wallet,
  PlusCircle, Sparkles, User, Package2,
  Tag, Bell, ShieldCheck, Store, BarChart3,
  Settings, Truck, Zap, Crown, Star, HelpCircle, MessageCircle,
} from "lucide-react"

function isActive(href: string, pathname: string) {
  if (href === "/dashboard/seller") return pathname === href
  return pathname.startsWith(href)
}

function SellerBottomNav() {
  const pathname = usePathname()
  const { unreadChats } = useSellerInboxCounts()

  const BOTTOM_NAV = [
    { label: "Home",    href: "/dashboard/seller",         icon: LayoutDashboard },
    { label: "Orders",  href: "/dashboard/seller/orders",  icon: ShoppingBag },
    { label: "Post",    href: "/dashboard/seller/post",    icon: PlusCircle, primary: true },
    { label: "Chat",    href: "/chat",                     icon: MessageCircle, count: unreadChats },
    { label: "Profile", href: "/dashboard/profile",        icon: User },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex h-16 shadow-lg">
      {BOTTOM_NAV.map(({ label, href, icon: Icon, primary, count }) => {
        const active = isActive(href, pathname)
        return (
          <Link key={href} href={href} className={cn("relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors", active ? "text-primary" : "text-muted-foreground", primary && "relative")}>
            {primary ? (
              <div className="absolute -top-5 h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Icon className="h-6 w-6 text-white" />
              </div>
            ) : (
              <div className="relative">
                <Icon className="h-5 w-5" />
                {!!count && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </div>
            )}
            {!primary && <span className="text-[10px] font-medium">{label}</span>}
            {primary && <span className="text-[10px] font-medium mt-5">{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { unreadChats, pendingOffers } = useSellerInboxCounts()

  const NAV_ITEMS = [
    { label: "Dashboard",    href: "/dashboard/seller",                icon: LayoutDashboard },
    { label: "Post Listing", href: "/dashboard/seller/post",           icon: PlusCircle, primary: true },
    { label: "My Listings",  href: "/dashboard/seller/listings",       icon: Package },
    { label: "Orders",       href: "/dashboard/seller/orders",         icon: ShoppingBag },
    { label: "Chat",         href: "/chat",                            icon: MessageCircle,
      ...(unreadChats > 0 ? { badge: unreadChats > 9 ? "9+" : String(unreadChats), badgeColor: "bg-red-500" } : {}) },
    { label: "My Purchases", href: "/dashboard/buyer/orders",          icon: Package },
    { label: "Offers Inbox", href: "/dashboard/seller/offers",         icon: Tag,
      ...(pendingOffers > 0 ? { badge: pendingOffers > 9 ? "9+" : String(pendingOffers), badgeColor: "bg-red-500" } : {}) },
    { label: "Bundle Deals", href: "/dashboard/seller/bundles",        icon: Package2 },
    { label: "Flash Deals",  href: "/dashboard/seller/flash-deals",    icon: Sparkles },
    { label: "Boost Center", href: "/dashboard/seller/boost",          icon: Zap },
    { label: "Earnings",     href: "/dashboard/seller/earnings",       icon: BarChart3 },
    { label: "FBZ",          href: "/dashboard/fbz",                   icon: Truck, badge: "FBZ", badgeColor: "bg-emerald-500" },
    { label: "Hub Verify",   href: "/dashboard/seller/hub-verify",     icon: ShieldCheck },
    { label: "Store Profile",href: "/dashboard/seller/store",          icon: Store },
    { label: "Notifications",href: "/notifications",                   icon: Bell },
    { label: "Profile",      href: "/dashboard/profile",               icon: User },
    { label: "My Reviews",   href: "/dashboard/seller/reviews",         icon: Star },
    { label: "Q&A",          href: "/dashboard/seller/qna",             icon: HelpCircle },
    { label: "Upgrade Plan", href: "/pricing",                          icon: Crown, primary: true },
    { label: "Settings",     href: "/dashboard/seller/settings",       icon: Settings },
  ]

  return (
    <RoleGuard allowedRoles={["seller", "both", "moderator", "admin"]}>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar navItems={NAV_ITEMS} role="Seller" roleColor="bg-emerald-600" isActive={isActive} />
        <div className="flex-1 min-w-0">
          <main className="pb-20 md:pb-0">{children}</main>
        </div>
      </div>
      <SellerBottomNav />
    </RoleGuard>
  )
}
