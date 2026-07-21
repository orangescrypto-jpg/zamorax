"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { HOMEPAGE_CATEGORIES } from "@/constants/categories"
import { ListingCard } from "@/components/listings/ListingCard"
import { cn } from "@/lib/utils"
import { Loader2, ArrowRight, Store, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { Listing } from "@/src/types"

const PER_TAB  = 8
const ALL_SLUG = "__all__"

const TABS = [
  { slug: ALL_SLUG, name: "All" },
  ...HOMEPAGE_CATEGORIES.map(c => ({ slug: c.slug, name: c.name })),
]

export function CategoryListings({ excludeIds = [] }: { excludeIds?: string[] }) {
  const router = useRouter()
  const [activeSlug, setActiveSlug] = useState(ALL_SLUG)
  const [officialOnly, setOfficialOnly] = useState(false)
  const [cache,      setCache]      = useState<Record<string, Listing[]>>({})
  const [loading,    setLoading]    = useState(false)

  const cacheKey = useCallback((slug: string, official: boolean) => `${slug}::${official ? "direct" : "all"}`, [])

  const fetchCategory = useCallback(async (slug: string, official: boolean) => {
    const key = cacheKey(slug, official)
    if (cache[key] !== undefined) return
    setLoading(true)
    try {
      // Use server-side /api/listings — has access to CF D1 env vars
      const qs = new URLSearchParams()
      if (slug !== ALL_SLUG) qs.set("category", slug)
      if (official) qs.set("official", "true")
      qs.set("limit", String(PER_TAB))

      const res  = await fetch(`/api/listings?${qs.toString()}`)
      const data = await res.json() as { items?: Listing[] }
      setCache(prev => ({ ...prev, [key]: data.items ?? [] }))
    } catch {
      setCache(prev => ({ ...prev, [key]: [] }))
    }
    setLoading(false)
  }, [cache, cacheKey])

  useEffect(() => { fetchCategory(activeSlug, officialOnly) }, [activeSlug, officialOnly]) // eslint-disable-line

  const activeName = TABS.find(t => t.slug === activeSlug)?.name ?? ""
  const activeKey = cacheKey(activeSlug, officialOnly)

  // Boosted listings already have their own homepage spot (Featured Listings),
  // and official/picked listings already have their own spot (Zamorax
  // Enterprises Direct up top) — so don't show either again here, even if
  // the backend exclusion in /api/listings ever falls out of sync.
  const excludeSet = new Set(excludeIds)
  const listings = (cache[activeKey] ?? [])
    .filter(l => !excludeSet.has(l.id) && !l.isZamoraxPick)
    .sort((a, b) => (b.isBoosted ? 1 : 0) - (a.isBoosted ? 1 : 0))

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">Shop by Category</h2>
        {activeSlug !== ALL_SLUG ? (
          <Link
            href={`/search?category=${activeSlug}${officialOnly ? "&official=true" : ""}`}
            className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
          >
            See all {activeName} <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            href={officialOnly ? "/search?official=true" : "/search"}
            className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
          >
            Browse all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Category tabs — scrollable */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {TABS.map(tab => (
          <button
            key={tab.slug}
            onClick={() => setActiveSlug(tab.slug)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all border",
              activeSlug === tab.slug
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Direct vs All Sellers toggle */}
      <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-0.5 mb-4">
        <button
          onClick={() => setOfficialOnly(false)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all",
            !officialOnly ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          All Sellers
        </button>
        <button
          onClick={() => setOfficialOnly(true)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1",
            officialOnly ? "bg-primary text-white shadow-sm" : "text-muted-foreground"
          )}
        >
          <Zap className="h-3 w-3" />
          Zamorax Direct
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-4 rounded-2xl border border-dashed border-border bg-muted/20 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {officialOnly
                ? `No Zamorax Direct ${activeSlug === ALL_SLUG ? "listings" : activeName + " listings"} yet`
                : activeSlug === ALL_SLUG
                  ? "Be the first to list on Zamorax!"
                  : `No ${activeName} listings yet`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {officialOnly
                ? "Check back soon, or browse listings from all sellers instead."
                : activeSlug === ALL_SLUG
                  ? "We're just getting started. Post your item and reach thousands of buyers."
                  : `Be the first seller in ${activeName}. It's free to list.`}
            </p>
          </div>
          {officialOnly ? (
            <Button
              onClick={() => setOfficialOnly(false)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Store className="h-3.5 w-3.5" />
              Browse All Sellers
            </Button>
          ) : (
            <Button
              onClick={() => router.push("/dashboard/seller/post")}
              className="bg-primary text-white hover:bg-primary/90 gap-2"
              size="sm"
            >
              <Zap className="h-3.5 w-3.5" />
              Post a Free Ad
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
          {listings.length >= PER_TAB && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm" asChild className="text-xs">
                <Link href={
                  activeSlug === ALL_SLUG
                    ? (officialOnly ? "/search?official=true" : "/search")
                    : `/search?category=${activeSlug}${officialOnly ? "&official=true" : ""}`
                }>
                  See more {activeSlug !== ALL_SLUG ? activeName : ""} listings
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
