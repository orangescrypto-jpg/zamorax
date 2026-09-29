// components/home/CategoryListings.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { getActiveHomepageCategories } from "@/constants/categories"
import { useSubSettings } from "@/hooks/useSubSettings"
import { ListingCard } from "@/components/listings/ListingCard"
import { cn } from "@/lib/utils"
import { ArrowRight, Store, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { Listing } from "@/src/types"

const ALL_SLUG = "__all__"

export function CategoryListings({ excludeIds = [], initialListings }: { excludeIds?: string[]; initialListings?: Listing[] }) {
  const router = useRouter()
  const { settings } = useSubSettings()
  const perTab = settings.categoryListingsPerTab
  const TABS = [
    { slug: ALL_SLUG, name: "All" },
    ...getActiveHomepageCategories(settings.disabledCategorySlugs, settings.categoryOrder, settings.homepageOverrideSlugs).map(c => ({ slug: c.slug, name: c.name })),
  ]
  const [activeSlug, setActiveSlug] = useState(ALL_SLUG)
  const [officialOnly, setOfficialOnly] = useState(false)
  // Seeded from the server for the default tab (All / All Sellers) so the
  // first paint already has products. Holds up to 50; sliced to perTab below.
  const [cache,      setCache]      = useState<Record<string, Listing[]>>(
    initialListings ? { [`${ALL_SLUG}::all`]: initialListings } : {}
  )
  // Start true when nothing is seeded so the first paint shows a skeleton,
  // never the "Be the first to list" empty state.
  const [loading,    setLoading]    = useState(!initialListings)

  const cacheKey = useCallback((slug: string, official: boolean) => `${slug}::${official ? "direct" : "all"}`, [])

  const fetchCategory = useCallback(async (slug: string, official: boolean) => {
    const key = cacheKey(slug, official)
    if (cache[key] !== undefined) { setLoading(false); return }
    setLoading(true)
    try {
      // Use server-side /api/listings — has access to CF D1 env vars
      const qs = new URLSearchParams()
      if (slug !== ALL_SLUG) qs.set("category", slug)
      if (official) qs.set("official", "true")
      qs.set("limit", "50")
      qs.set("sort", "latest") // boosted listings already have Featured; newest first here

      const res  = await fetch(`/api/listings?${qs.toString()}`)
      const data = await res.json() as { items?: Listing[] }
      setCache(prev => ({ ...prev, [key]: data.items ?? [] }))
    } catch {
      setCache(prev => ({ ...prev, [key]: [] }))
    }
    setLoading(false)
  }, [cache, cacheKey, perTab])

  // Cache always stores the full fetched set (limit 50); perTab only slices it
  // for display, so a settings change never needs a refetch.
  useEffect(() => { fetchCategory(activeSlug, officialOnly) }, [activeSlug, officialOnly]) // eslint-disable-line

  const activeName = TABS.find(t => t.slug === activeSlug)?.name ?? ""
  const activeKey = cacheKey(activeSlug, officialOnly)

  // Boosted listings already have their own homepage spot (Featured
  // Listings), so keep excluding those. Official/picked listings used to
  // be filtered out here too (they had their own separate "Zamorax
  // Enterprises Direct" spot up top) — but they now show in "All Sellers"
  // like any other listing, same as the backend /api/listings query.
  // Official listings should always appear in "All Sellers" alongside every
  // other listing (per requirement — same item can appear in both the top
  // carousel and here), so no exclude is applied on either tab anymore.
  const allFetched = cache[activeKey] ?? []
  const listings = [...allFetched]
    .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
    .slice(0, perTab)
  const hasMore = allFetched.length > perTab

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" aria-busy="true">
          {Array.from({ length: Math.min(perTab, 8) }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
              <div className="aspect-square bg-muted/60" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted/60 rounded w-4/5" />
                <div className="h-3 bg-muted/60 rounded w-1/2" />
              </div>
            </div>
          ))}
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
          {hasMore && (
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
