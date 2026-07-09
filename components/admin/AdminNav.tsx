"use client"
// components/admin/AdminNav.tsx — replace your current file with this

import Link from "next/link"
import { AuthService } from "@/src/services"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Users, ListChecks,
  ShieldAlert, BarChart3, Wallet,
  ShieldCheck, LogOut, ChevronRight, Zap, Users2, Settings, Truck, Package, MessageSquare,
} from "lucide-react"
import { useRouter } from "next/navigation"

const NAV_ITEMS = [
  { label: "Overview",       href: "/admin",                  icon: LayoutDashboard },
  { label: "Users",          href: "/admin/users",            icon: Users },
  { label: "Verifications",  href: "/admin/verifications",    icon: ShieldCheck },
  { label: "Listings",       href: "/admin/listings",         icon: ListChecks },
  { label: "Q&A",            href: "/admin/qna",              icon: MessageSquare },
  { label: "Disputes",       href: "/admin/disputes",         icon: ShieldAlert },
  { label: "Hub Verify",     href: "/admin/hub-verify",       icon: Zap },
  { label: "Logistics",     href: "/admin/logistics",         icon: Truck },
  { label: "ZLA Applications", href: "/admin/logistics/applications", icon: Package },
  { label: "Revenue",        href: "/admin/revenue",          icon: BarChart3 },
  { label: "Withdrawals",    href: "/admin/withdrawals",      icon: Wallet },
  { label: "Agent Withdrawals", href: "/admin/agent-withdrawals", icon: Wallet },
  { label: "Settings",       href: "/admin/settings",         icon: Settings },
]

export function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await AuthService.signOut()
    router.replace("/login")
  }

  return (
    <aside className="w-60 shrink-0 hidden md:flex flex-col border-r bg-secondary min-h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-white/10">
        <p className="text-white font-heading font-bold text-xl tracking-tight">
          Zamorax <span className="text-primary text-sm font-normal ml-1">Admin</span>
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
