"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { ALL_CATEGORIES } from "@/constants/categories"
import { Phone, Laptop, Monitor, Shirt, Home, Pill, Baby, Trophy, ShoppingCart, MoreHorizontal } from "lucide-react"

const iconMap: Record<string, React.ReactNode> = {
  "phones-tablets": <Phone className="h-5 w-5" />,
  "computing":      <Laptop className="h-5 w-5" />,
  "electronics":    <Monitor className="h-5 w-5" />,
  "fashion":        <Shirt className="h-5 w-5" />,
  "home-office":    <Home className="h-5 w-5" />,
  "health-beauty":  <Pill className="h-5 w-5" />,
  "baby-products":  <Baby className="h-5 w-5" />,
  "sporting-goods": <Trophy className="h-5 w-5" />,
  "groceries":      <ShoppingCart className="h-5 w-5" />,
  "other":          <MoreHorizontal className="h-5 w-5" />,
}

const colorMap: Record<string, { bg: string; icon: string }> = {
  "phones-tablets": { bg: "bg-blue-50",    icon: "text-blue-600" },
  "computing":      { bg: "bg-violet-50",  icon: "text-violet-600" },
  "electronics":    { bg: "bg-indigo-50",  icon: "text-indigo-600" },
  "fashion":        { bg: "bg-pink-50",    icon: "text-pink-600" },
  "home-office":    { bg: "bg-emerald-50", icon: "text-emerald-600" },
  "health-beauty":  { bg: "bg-rose-50",    icon: "text-rose-600" },
  "baby-products":  { bg: "bg-amber-50",   icon: "text-amber-600" },
  "sporting-goods": { bg: "bg-orange-50",  icon: "text-orange-600" },
  "groceries":      { bg: "bg-green-50",   icon: "text-green-600" },
  "other":          { bg: "bg-gray-50",    icon: "text-gray-500" },
}

export function CategoryGrid() {
  const router = useRouter()
  const { isAuthenticated, isSeller } = useAuth()

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-secondary">Browse Categories</h2>
        <Link href="/search" className="text-xs text-primary font-medium">See all →</Link>
      </div>

      {/* 5-col mobile scrollable row + wrapping grid on larger screens */}
      <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-10 gap-2">
        {ALL_CATEGORIES.map((cat) => {
          const icon = iconMap[cat.slug] || iconMap["other"]
          const color = colorMap[cat.slug] || colorMap["other"]
          return (
            <Link
              href={`/categories/${cat.slug}`}
              key={cat.id}
              className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-white border border-border/40 hover:shadow-md hover:border-primary/20 transition-all text-center group"
            >
              <div className={`p-2 rounded-xl ${color.bg} ${color.icon} group-hover:scale-110 transition-transform`}>
                {icon}
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-secondary leading-tight line-clamp-2">
                {cat.name}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
