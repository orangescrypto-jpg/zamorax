"use client"

// components/home/RecentlyViewedRow.tsx
// Horizontal scrolling row of recently viewed listings on the homepage.
// Only renders when authenticated AND recentlyViewedEnabled AND has items.

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Clock } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { RecentlyViewedService } from "@/src/services"
import { formatPrice } from "@/lib/utils"
import type { RecentlyViewedItem } from "@/src/types"

export function RecentlyViewedRow() {
  const { user, isAuthenticated } = useAuth()
  const { settings } = usePlatformSettings()
  const [items, setItems] = useState<RecentlyViewedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated() || !user?.uid || !settings.recentlyViewedEnabled) {
      setLoading(false)
      return
    }

    RecentlyViewedService.getRecentlyViewed(user.uid, 10)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.uid, isAuthenticated, settings.recentlyViewedEnabled])

  if (!settings.recentlyViewedEnabled) return null
  if (!isAuthenticated())               return null
  if (loading)                          return null
  if (items.length === 0)               return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Recently Viewed</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
        {items.map((item) => (
          <Link
            key={item.listingId}
            href={`/listings/${item.listingId}`}
            className="shrink-0 w-36 group"
          >
            <div className="relative w-36 h-28 rounded-xl overflow-hidden bg-muted mb-1.5">
              {item.images?.[0] ? (
                <Image
                  src={item.images[0]}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="144px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
              {item.title}
            </p>
            <p className="text-xs font-bold text-primary mt-0.5">
              {formatPrice(item.priceSale)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
