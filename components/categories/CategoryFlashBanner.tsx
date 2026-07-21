"use client"
// components/categories/CategoryFlashBanner.tsx
// Category-scoped flash sale banner. Queries the same live system the
// /flash-deals page uses (listings.flashDeal), not the separate legacy
// `flashDeals` collection the homepage FlashDealsSection reads from —
// that inconsistency is pre-existing and out of scope here.

import { useEffect, useState } from "react"
import { AdminService, where } from "@/src/services"
import { Zap } from "lucide-react"
import Link from "next/link"

export function CategoryFlashBanner({ categorySlug }: { categorySlug: string }) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    AdminService.getCollection("listings", [
      where("isActive", "==", true),
      where("category", "==", categorySlug),
      where("flashDeal", "!=", null),
    ])
      .then((rows) => {
        if (!active) return
        const activeDeals = (rows as any[]).filter(
          (d) => d.flashDeal && new Date(d.flashDeal.endsAt).getTime() > Date.now()
        )
        setCount(activeDeals.length)
      })
      .catch(() => { if (active) setCount(0) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [categorySlug])

  if (loading || count === 0) return null

  return (
    <Link
      href="/flash-deals"
      className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 hover:bg-red-100/70 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-full bg-red-100 text-red-600 shrink-0">
          <Zap className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold text-red-800">
          {count} flash deal{count === 1 ? "" : "s"} live in this category right now
        </p>
      </div>
      <span className="text-xs font-medium text-red-600 shrink-0">Shop now →</span>
    </Link>
  )
}
