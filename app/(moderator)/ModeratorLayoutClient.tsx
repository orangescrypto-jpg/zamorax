"use client"
// app/(moderator)/ModeratorLayoutClient.tsx

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { DashboardSidebar } from "@/components/shared/DashboardSidebar"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ListChecks, ShieldAlert, ShieldCheck,
  Flag, Package, Clock, Truck, Users, BookOpen, User,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview",           href: "/moderator",                           icon: LayoutDashboard },
  { label: "Listings",           href: "/moderator/listings",                  icon: ListChecks },
  { label: "Disputes",           href: "/moderator/disputes",                  icon: ShieldAlert },
  { label: "Verifications",      href: "/moderator/verifications",             icon: ShieldCheck },
  { label: "Reports",            href: "/moderator/reports",                   icon: Flag },
  { label: "Blog",               href: "/moderator/blog",                      icon: BookOpen },
  { label: "Logistics Disputes", href: "/moderator/logistics/disputes",        icon: Package },
  { label: "ZLA Monitor",        href: "/moderator/logistics/zlas",            icon: Truck },
  { label: "Stale Shipments",    href: "/moderator/logistics/stale",           icon: Clock },
  { label: "ZLA Applications",   href: "/moderator/logistics/applications",    icon: Users },
  { label: "Profile",            href: "/dashboard/profile",                   icon: User },
]

const BOTTOM_NAV = [
  { label: "Overview",  href: "/moderator",                    icon: LayoutDashboard },
  { label: "Listings",  href: "/moderator/listings",           icon: ListChecks },
  { label: "Disputes",  href: "/moderator/disputes",           icon: ShieldAlert },
  { label: "Logistics", href: "/moderator/logistics/disputes", icon: Package },
  { label: "Profile",   href: "/dashboard/profile",            icon: User },
]

function isActive(href: string, pathname: string) {
  if (href === "/moderator") return pathname === href
  return pathname === href || pathname.startsWith(href + "/")
}

function ModeratorBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t flex h-16 shadow-lg">
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

export default function ModeratorLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["moderator", "admin"]}>
      <div className="flex min-h-screen bg-background">
        <DashboardSidebar navItems={NAV_ITEMS} role="Moderator" roleColor="bg-purple-600" isActive={isActive} />
        <div className="flex-1 min-w-0">
          <main className="pb-20 md:pb-0">{children}</main>
        </div>
      </div>
      <ModeratorBottomNav />
    </RoleGuard>
  )
}
