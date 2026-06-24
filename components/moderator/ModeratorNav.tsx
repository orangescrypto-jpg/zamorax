"use client"

import { AuthService } from "@/src/services"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ListChecks, ShieldAlert, ShieldCheck, LogOut, ChevronRight,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview",      href: "/moderator",               icon: LayoutDashboard },
  { label: "Listings",      href: "/moderator/listings",      icon: ListChecks },
  { label: "Disputes",      href: "/moderator/disputes",      icon: ShieldAlert },
  { label: "Verifications", href: "/moderator/verifications", icon: ShieldCheck },
]

// Named export — fixes the layout import error
export function ModeratorNav() {
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
          Zamorax <span className="text-primary text-sm font-normal ml-1">Moderator</span>
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = href === "/moderator"
            ? pathname === "/moderator"
            : pathname.startsWith(href)
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-red-400 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </aside>
  )
}

// Default export too — so both import styles work
export default ModeratorNav
