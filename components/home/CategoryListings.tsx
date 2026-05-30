"use client"

import { AdminService, where, orderBy, limit } from "@/src/services"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { ALL_CATEGORIES } from "@/constants/categories"
import { ListingCard } from "@/components/listings/ListingCard"
import { cn } from "@/lib/utils"
import { Loader2, ArrowRight } from "lucide-react"
import type { Listing } from "@/src/types"

const VISIBLE_CATEGORIES = ALL_CATEGORIES.slice(0, 8)
const PER_TAB = 8

export function CategoryListings() {
  const [activeSlug, setActiveSlug] = useState(VISIBLE_CATEGORIES[0]?.slug ?? "")
  const [cache, setCache] = useState<Record<string, Listing[]>>({})
  const [loading, setLoading] = useState(false)

  const fetchCategory = useCallback(async (slug: string) => {
    if (cache[slug]) return
    setLoading(true)
    try {
      const snap = await AdminService.getCollection("listings", [
        where("status", "==", "active"),
        where("categorySlug", "==", slug),
        orderBy("isBoosted", "desc"),
        orderBy("createdAt", "desc"),
        limit(PER_TAB),
      ])
      setCache(prev => ({ ...prev, [slug]: snap.map(d => d as unknown as Listing) }))
    } catch { /* silent */ }
    setLoading(false)
  }, [cache])

  useEffect(() => { fetchCategory(activeSlug) }, [activeSlug])

  const activeName = VISIBLE_CATEGORIES.find(c => c.slug === activeSlug)?.name ?? ""
  const listings = cache[activeSlug] ?? []

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">Shop by Category</h2>
        <Link href={`/categories/${activeSlug}`} className="text-xs text-primary font-medium flex items-center gap-0.5">
          See all {activeName} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {VISIBLE_CATEGORIES.map(cat => (
          <button
            key={cat.slug}
            onClick={() => setActiveSlug(cat.slug)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all border",
              activeSlug === cat.slug
                ? "bg-primary text-white border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No listings yet in this category.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {listings.map(l => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </section>
  )
}
