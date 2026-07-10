"use client"
// app/(admin)/AdminLayoutClient.tsx
// Client component — contains the sidebar, bottom nav, and RoleGuard.
// Imported by the server layout.tsx above.

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { DashboardSidebar } from "@/components/shared/DashboardSidebar"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Users, ShieldAlert, BarChart3,
  Settings, ShieldCheck, ListChecks, Wallet,
  Zap, Flag, CreditCard, Warehouse, User,
  Truck, Megaphone, Package, BookOpen, Banknote, FileText, Rocket, MessageSquare, HelpCircle, Tag, ShoppingBag, Gift, Mail,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview",         href: "/admin/overview",               icon: LayoutDashboard },
  { label: "Users",            href: "/admin/users",                  icon: Users },
  { label: "Verifications",    href: "/admin/verifications",          icon: ShieldCheck },
  { label: "Listings",         href: "/admin/listings",               icon: ListChecks },
  { label: "Disputes",         href: "/admin/disputes",               icon: ShieldAlert },
  { label: "Reports",          href: "/admin/reports",                icon: Flag },
  { label: "Contact Messages", href: "/admin/messages",               icon: Mail },
  { label: "Hub Verify",       href: "/admin/hub-verify",             icon: Zap },
  { label: "Logistics",        href: "/admin/logistics",              icon: Truck },
  { label: "ZLA Applications", href: "/admin/logistics/applications", icon: Package },
  { label: "Revenue",          href: "/admin/revenue",                icon: BarChart3 },
  { label: "Boost",            href: "/admin/boost",                  icon: Rocket },
  { label: "Listing Boosts",   href: "/admin/listing-boosts",         icon: Zap },
  { label: "Withdrawals",      href: "/admin/withdrawals",            icon: Wallet },
  { label: "Agent Withdrawals",href: "/admin/agent-withdrawals",      icon: Gift },
  { label: "Orders",           href: "/admin/orders",                 icon: ShoppingBag },
  { label: "Payments",         href: "/admin/payments",               icon: Banknote },
  { label: "Payouts",          href: "/admin/payouts",                icon: CreditCard },
  { label: "FBZ Management",   href: "/admin/fbz",                    icon: Warehouse, badge: "FBZ", badgeColor: "bg-emerald-500" },
  { label: "Banners",          href: "/admin/banners",                icon: Megaphone },
  { label: "Blog",             href: "/admin/blog",                   icon: BookOpen },
  { label: "Content",          href: "/admin/content",                icon: FileText },
  { label: "Q&A",              href: "/admin/qna",                    icon: HelpCircle },
  { label: "Settings",         href: "/admin/settings",               icon: Settings },
  { label: "Profile",          href: "/dashboard/profile",            icon: User },
  { label: "Offers Inbox",     href: "/dashboard/seller/offers",      icon: Tag },
  { label: "Messages",         href: "/chat",                         icon: MessageSquare },
]

const BOTTOM_NAV = [
  { label: "Overview", href: "/admin/overview",              icon: LayoutDashboard },
  { label: "Users",    href: "/admin/users",                 icon: Users },
  { label: "Messages", href: "/chat",                        icon: MessageSquare },
  { label: "Offers",   href: "/dashboard/seller/offers",     icon: Tag },
  { label: "Settings", href: "/admin/settings",              icon: Settings },
]

function isActive(href: string, pathname: string) {
  if (href === "/admin/overview") return pathname === "/admin" || pathname.startsWith("/admin/overview")
  return pathname === href || pathname.startsWith(href + "/")
}

function AdminBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-secondary text-secondary-foreground border-t flex h-16 shadow-lg">
      {BOTTOM_NAV.map(({ label, href, icon: Icon }) => {
        const active = isActive(href, pathname)
        return (
          <Link key={href} href={href} className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors", active ? "text-primary" : "text-secondary-foreground/60")}>
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    // RoleGuard here is the client-side last line of defence (catches hydration edge cases)
    <RoleGuard allowedRoles={["admin"]}>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar navItems={NAV_ITEMS} role="Admin" roleColor="bg-red-600" isActive={isActive} />
        <div className="flex-1 min-w-0">
          <main className="pb-20 md:pb-0">{children}</main>
        </div>
      </div>
      <AdminBottomNav />
    </RoleGuard>
  )
}
