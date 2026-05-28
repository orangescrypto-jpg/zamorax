"use client"
// components/shared/DashboardSidebar.tsx
// Static sidebar used across ALL dashboard roles (buyer, seller, admin, moderator)
// Modelled after the Homverax screenshot: Zamorax logo → user info → nav items → sign out

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { LogOut, ChevronRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface SidebarNavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  badgeColor?: string
  primary?: boolean
}

interface DashboardSidebarProps {
  navItems: SidebarNavItem[]
  role: string
  roleColor?: string
  isActive: (href: string, pathname: string) => boolean
}

export function DashboardSidebar({ navItems, role, roleColor = "bg-primary", isActive }: DashboardSidebarProps) {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const router = useRouter()

  const initial = (user?.storeName || user?.fullName || user?.email || role)[0].toUpperCase()
  const displayName = user?.storeName || user?.fullName || role

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r bg-card h-screen sticky top-0 overflow-y-auto">
      {/* ── Brand ── */}
      <Link
        href="/"
        className="flex items-center gap-3 px-5 py-4 border-b hover:bg-muted/40 transition-colors group shrink-0"
      >
        {/* Z logo mark */}
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-sm">
          <svg viewBox="0 0 512 512" className="w-full h-full">
            <rect width="512" height="512" fill="#0a0a0a"/>
            <path d="M256 52 L422 150 L422 362 L256 460 L90 362 L90 150 Z" fill="none" stroke="#f97316" strokeWidth="24" strokeLinejoin="round"/>
            <line x1="168" y1="168" x2="332" y2="168" stroke="#f97316" strokeWidth="46" strokeLinecap="round"/>
            <line x1="320" y1="168" x2="185" y2="332" stroke="#f97316" strokeWidth="46" strokeLinecap="round"/>
            <line x1="172" y1="332" x2="285" y2="332" stroke="#f97316" strokeWidth="46" strokeLinecap="round"/>
            <path d="M278 305 L355 340 L278 372" fill="#f97316"/>
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
          Zamorax
        </span>
      </Link>

      {/* ── User info ── */}
      {user && (
        <div className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 ring-2 ring-primary/20">
              <span className="text-sm font-bold text-primary">{initial}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-2">
            <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white", roleColor)}>
              {role}
            </span>
          </div>
        </div>
      )}

      {/* ── Nav items ── */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon, badge, badgeColor, primary }) => {
          const active = isActive(href, pathname)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : primary
                  ? "text-primary hover:bg-primary/10"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 leading-tight">{label}</span>
              {badge && (
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0", badgeColor || "bg-primary")}>
                  {badge}
                </span>
              )}
              {active && !badge && <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0" />}
            </Link>
          )
        })}
      </nav>

      {/* ── Sign out ── */}
      <div className="px-3 py-3 border-t shrink-0">
        <button
          onClick={async () => { await signOut(); router.push("/") }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
