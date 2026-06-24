"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { DashboardSidebar } from "@/components/shared/DashboardSidebar"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ShoppingBag, Heart, User,
  MessageSquare, Tag, Bell, ShieldAlert,
  Settings, Search, RotateCcw, Gift,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Dashboard",     href: "/dashboard/buyer",              icon: LayoutDashboard },
  { label: "Orders",        href: "/dashboard/buyer/orders",       icon: ShoppingBag },
  { label: "Saved Items",   href: "/dashboard/buyer/saved",        icon: Heart },
  { label: "Offers",        href: "/dashboard/buyer/offers",       icon: Tag },
  { label: "Search Alerts", href: "/dashboard/buyer/alerts",       icon: Search },
  { label: "Returns",       href: "/dashboard/buyer/returns",      icon: RotateCcw },
  { label: "Disputes",      href: "/dashboard/buyer/disputes/new", icon: ShieldAlert },
  { label: "Refer & Earn",  href: "/dashboard/referrals",          icon: Gift },
  { label: "Messages",      href: "/chat",                         icon: MessageSquare },
  { label: "Notifications", href: "/notifications",                icon: Bell },
  { label: "Profile",       href: "/dashboard/profile",            icon: User },
  { label: "Settings",      href: "/dashboard/buyer/settings",     icon: Settings },
]

const BOTTOM_NAV = [
  { label: "Home",    href: "/dashboard/buyer",        icon: LayoutDashboard },
  { label: "Orders",  href: "/dashboard/buyer/orders", icon: ShoppingBag },
  { label: "Saved",   href: "/dashboard/buyer/saved",  icon: Heart },
  { label: "Offers",  href: "/dashboard/buyer/offers", icon: Tag },
  { label: "Profile", href: "/dashboard/profile",      icon: User },
]

function isActive(href: string, pathname: string) {
  if (href === "/dashboard/buyer") return pathname === href
  return pathname.startsWith(href)
}

function BuyerBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex h-16 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      {BOTTOM_NAV.map(({ label, href, icon: Icon }) => {
        const active = isActive(href, pathname)
        return (
          <Link key={href} href={href} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors", active ? "text-primary" : "text-muted-foreground")}>
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["buyer", "seller", "both"]}>
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
