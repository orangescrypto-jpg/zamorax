"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { DashboardSidebar } from "@/components/shared/DashboardSidebar"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Package, ShoppingBag, Wallet,
  PlusCircle, Sparkles, User, Package2,
  Tag, Bell, ShieldCheck, Store, BarChart3,
  Settings, Truck, Zap, Crown,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/dashboard/seller",                icon: LayoutDashboard },
  { label: "Post Listing", href: "/dashboard/seller/post",           icon: PlusCircle, primary: true },
  { label: "My Listings",  href: "/dashboard/seller/listings",       icon: Package },
  { label: "Orders",       href: "/dashboard/seller/orders",         icon: ShoppingBag },
  { label: "Offers Inbox", href: "/dashboard/seller/offers",         icon: Tag },
  { label: "Bundle Deals", href: "/dashboard/seller/bundles",        icon: Package2 },
  { label: "Flash Deals",  href: "/dashboard/seller/flash-deals",    icon: Sparkles },
  { label: "Boost Center", href: "/dashboard/seller/boost",          icon: Zap },
  { label: "Wallet",       href: "/dashboard/seller/wallet",         icon: Wallet },
  { label: "Earnings",     href: "/dashboard/seller/earnings",       icon: BarChart3 },
  { label: "FBZ",          href: "/dashboard/fbz",                   icon: Truck, badge: "FBZ", badgeColor: "bg-emerald-500" },
  { label: "Hub Verify",   href: "/dashboard/seller/hub-verify",     icon: ShieldCheck },
  { label: "Store Profile",href: "/dashboard/seller/store",          icon: Store },
  { label: "Notifications",href: "/notifications",                   icon: Bell },
  { label: "Profile",      href: "/dashboard/profile",               icon: User },
  { label: "Upgrade Plan", href: "/pricing",                          icon: Crown, primary: true },
  { label: "Settings",     href: "/dashboard/seller/settings",       icon: Settings },
]

const BOTTOM_NAV = [
  { label: "Home",    href: "/dashboard/seller",         icon: LayoutDashboard },
  { label: "Orders",  href: "/dashboard/seller/orders",  icon: ShoppingBag },
  { label: "Post",    href: "/dashboard/seller/post",    icon: PlusCircle, primary: true },
  { label: "Wallet",  href: "/dashboard/seller/wallet",  icon: Wallet },
  { label: "Profile", href: "/dashboard/profile",        icon: User },
]

function isActive(href: string, pathname: string) {
  if (href === "/dashboard/seller") return pathname === href
  return pathname.startsWith(href)
}

function SellerBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex h-16 shadow-lg">
      {BOTTOM_NAV.map(({ label, href, icon: Icon, primary }) => {
        const active = isActive(href, pathname)
        return (
          <Link key={href} href={href} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors", active ? "text-primary" : "text-muted-foreground", primary && "relative")}>
            {primary ? (
              <div className="absolute -top-5 h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <Icon className="h-6 w-6 text-white" />
              </div>
            ) : <Icon className="h-5 w-5" />}
            {!primary && <span className="text-[10px] font-medium">{label}</span>}
            {primary && <span className="text-[10px] font-medium mt-5">{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["seller", "both"]}>
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
