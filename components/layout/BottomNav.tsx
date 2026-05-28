"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Home, Search, PlusCircle, ShoppingBag, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isSeller } = useAuth()

  if (!isAuthenticated()) return null

  const seller = isSeller()

  const tabs = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/search", icon: Search, label: "Browse" },
    // Post only for sellers
    ...(seller ? [{ href: "/dashboard/seller/post", icon: PlusCircle, label: "Post", primary: true }] : []),
    { href: seller ? "/dashboard/seller/orders" : "/dashboard/buyer/orders", icon: ShoppingBag, label: "Orders" },
    { href: "/dashboard/profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden safe-area-pb">
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href))
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full py-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
                tab.primary && "bg-primary rounded-xl text-white shadow-lg -mt-4 h-14 w-14 mx-2"
              )}
            >
              <Icon className={cn("h-5 w-5", tab.primary && "h-6 w-6")} />
              <span className={tab.primary ? "font-semibold" : ""}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
