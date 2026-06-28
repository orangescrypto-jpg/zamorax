import type React from "react"
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ListChecks, ShoppingBag,
  Wallet, PlusCircle, Zap, Store, ShieldCheck, MessageSquare,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview",    href: "/dashboard/seller",               icon: LayoutDashboard },
  { label: "Listings",    href: "/dashboard/seller/listings",      icon: ListChecks },
  { label: "Post",        href: "/dashboard/seller/post",          icon: PlusCircle, primary: true },
  { label: "Orders",      href: "/dashboard/seller/orders",        icon: ShoppingBag },
  { label: "Q&A",         href: "/dashboard/seller/qna",           icon: MessageSquare },
  { label: "Earnings",    href: "/dashboard/seller/earnings",      icon: Wallet },
]

// Desktop-only extras (too many for mobile bottom bar)
const DESKTOP_EXTRA = [
  { label: "Flash Deals", href: "/dashboard/seller/flash-deals",  icon: Zap },
  { label: "Store",       href: "/dashboard/seller/store",        icon: Store },
  { label: "Hub Verify",  href: "/dashboard/seller/hub-verify",   icon: ShieldCheck },
]

export function SellerNav() {
  const pathname = usePathname()

  return (
    <>
      {/* ── Desktop top bar ── */}
      <header className="hidden md:flex items-center justify-between border-b bg-white px-6 py-3 sticky top-0 z-30 shadow-sm">
        <Link href="/dashboard/seller" className="font-heading font-bold text-lg text-secondary">
          Zamorax <span className="text-primary text-sm font-normal">Seller</span>
        </Link>
        <nav className="flex items-center gap-1">
          {[...NAV_ITEMS, ...DESKTOP_EXTRA].map(({ label, href, icon: Icon, primary }: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; primary?: boolean }) => {
            const active = pathname === href || (href !== "/dashboard/seller" && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  primary
                    ? "bg-primary text-white hover:bg-primary/90"
                    : active
                    ? "bg-muted text-secondary"
                    : "text-muted-foreground hover:text-secondary hover:bg-muted/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* ── Mobile bottom tab bar (5 core tabs only) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t flex items-stretch">
        {NAV_ITEMS.map(({ label, href, icon: Icon, primary }: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; primary?: boolean }) => {
          const active = pathname === href || (href !== "/dashboard/seller" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                primary
                  ? "text-white bg-primary rounded-t-xl mx-1 -mt-2 shadow-lg"
                  : active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", primary && "h-6 w-6")} />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
