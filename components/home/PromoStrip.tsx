"use client"
// components/home/PromoStrip.tsx
// Uses AdminService.subscribeToFeaturedBanners() — no raw Firestore calls.

import { AdminService } from "@/src/services"
import type { FeaturedBanner } from "@/src/services/admin"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Zap, ShieldCheck, TrendingUp, Tag, Star, Flame } from "lucide-react"

const ICON_MAP: Record<string, React.ReactNode> = {
  zap:      <Zap className="h-5 w-5" />,
  shield:   <ShieldCheck className="h-5 w-5" />,
  trending: <TrendingUp className="h-5 w-5" />,
  tag:      <Tag className="h-5 w-5" />,
  star:     <Star className="h-5 w-5" />,
  flame:    <Flame className="h-5 w-5" />,
}

const GRADIENT_MAP: Record<string, string> = {
  dark:   "from-secondary to-secondary/80",
  orange: "from-primary to-orange-600",
  teal:   "from-accent to-teal-600",
  purple: "from-violet-600 to-purple-700",
  green:  "from-emerald-600 to-green-700",
  red:    "from-red-600 to-rose-700",
}

const ACCENT_MAP: Record<string, string> = {
  dark:   "bg-yellow-400 text-secondary",
  orange: "bg-white/20 text-white",
  teal:   "bg-white/20 text-white",
  purple: "bg-white/20 text-white",
  green:  "bg-white/20 text-white",
  red:    "bg-white/20 text-white",
}

// Shown before Firestore loads or if admin has no active banners yet
const FALLBACK: FeaturedBanner[] = [
  { id: "f1", tag: "HOT DEALS",    title: "Phones & Tablets",    subtitle: "Verified phones at great prices",  href: "/categories/phones-tablets", imageUrl: "", color: "dark",   icon: "zap",      order: 0, active: true },
  { id: "f2", tag: "ESCROW SAFE",  title: "Laptops & Computing", subtitle: "Buy with full buyer protection",   href: "/categories/computing",       imageUrl: "", color: "orange", icon: "shield",   order: 1, active: true },
  { id: "f3", tag: "TRENDING NOW", title: "Fashion & Clothing",  subtitle: "New arrivals every day",           href: "/categories/fashion",          imageUrl: "", color: "teal",   icon: "trending", order: 2, active: true },
]

export function PromoStrip() {
  const [banners, setBanners] = useState<FeaturedBanner[]>(FALLBACK)

  useEffect(() => {
    // Uses the proper service method — no _ref_() or raw onSnapshot here
    const unsub = AdminService.subscribeToFeaturedBanners(data => {
      if (data.length > 0) setBanners(data)
      // else keep FALLBACK silently
    })
    return unsub
  }, [])

  if (banners.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-secondary">Featured Deals</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:overflow-visible snap-x snap-mandatory">
        {banners.map((banner) => {
          const gradient = GRADIENT_MAP[banner.color] ?? GRADIENT_MAP.dark
          const accent   = ACCENT_MAP[banner.color]   ?? ACCENT_MAP.dark
          const icon     = ICON_MAP[banner.icon]       ?? ICON_MAP.zap

          // If an image is set, it replaces the whole card content (same
          // "image replaces the styled design" convention as site-banners) —
          // only the link still applies.
          if (banner.imageUrl) {
            return (
              <Link
                key={banner.id}
                href={banner.href || "/search"}
                className="relative flex-shrink-0 w-56 md:w-auto snap-start rounded-2xl overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 bg-muted"
              >
                <img
                  src={banner.imageUrl}
                  alt={banner.title || banner.tag}
                  className="w-full h-full object-cover aspect-[4/3] md:aspect-video"
                />
              </Link>
            )
          }

          return (
            <Link
              key={banner.id}
              href={banner.href || "/search"}
              className={`
                relative flex-shrink-0 w-56 md:w-auto snap-start
                bg-gradient-to-br ${gradient}
                rounded-2xl p-4 flex flex-col gap-2 overflow-hidden
                group hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5
              `}
            >
              <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute -right-2 -bottom-2 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

              <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${accent}`}>
                {banner.tag}
              </span>
              <div className="relative z-10 text-white">
                {icon}
                <p className="font-bold text-sm mt-1 leading-tight">{banner.title}</p>
                <p className="text-white/70 text-xs mt-0.5">{banner.subtitle}</p>
              </div>
              <div className="flex items-center gap-1 text-white/80 text-xs font-medium mt-1">
                Shop now <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
