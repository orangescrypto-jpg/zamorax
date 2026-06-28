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
  MessageSquare, Tag, Settings, User, BookOpen,
  Truck,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/moderator",                        icon: LayoutDashboard },
  { label: "Listings",     href: "/moderator/listings",               icon: ListChecks },
  { label: "Disputes",     href: "/moderator/disputes",               icon: ShieldAlert },
  { label: "Verifications",href: "/moderator/verifications",          icon: ShieldCheck },
  { label: "Logistics",    href: "/moderator/logistics",              icon: Truck },
  { label: "Blog",         href: "/moderator/blog",                   icon: BookOpen },
  { label: "Offers Inbox", href: "/dashboard/seller/offers",          icon: Tag },
  { label: "Messages",     href: "/chat",                             icon: MessageSquare },
  { label: "Profile",      href: "/dashboard/profile",                icon: User },
  { label: "Settings",     href: "/moderator/settings",               icon: Settings },
]

const BOTTOM_NAV = [
  { label: "Home",     href: "/moderator",                   icon: LayoutDashboard },
  { label: "Listings", href: "/moderator/listings",          icon: ListChecks },
  { label: "Messages", href: "/chat",                        icon: MessageSquare },
  { label: "Offers",   href: "/dashboard/seller/offers",     icon: Tag },
  { label: "Profile",  href: "/dashboard/profile",           icon: User },
]

function isActive(href: string, pathname: string) {
  if (href === "/moderator") return pathname === "/moderator"
  return pathname === href || pathname.startsWith(href + "/")
}

function ModeratorBottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-secondary text-secondary-foreground border-t flex h-16 shadow-lg">
      {BOTTOM_NAV.map(({ label, href, icon: Icon }) => {
        const active = isActive(href, pathname)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors",
              active ? "text-primary" : "text-secondary-foreground/60"
            )}
          >
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
        <DashboardSidebar navItems={NAV_ITEMS} role="Moderator" roleColor="bg-blue-600" isActive={isActive} />
        <div className="flex-1 min-w-0">
          <main className="pb-20 md:pb-0">{children}</main>
        </div>
      </div>
      <ModeratorBottomNav />
    </RoleGuard>
  )
}
