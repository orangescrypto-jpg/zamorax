"use client"

import { AdminService, where, orderBy, limit } from "@/src/services"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { HOMEPAGE_CATEGORIES, ALL_CATEGORIES } from "@/constants/categories"
import { ListingCard } from "@/components/listings/ListingCard"
import { cn } from "@/lib/utils"
import { Loader2, ArrowRight, Store, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { Listing } from "@/src/types"

// Show ALL homepage categories (16), not just first 8
const PER_TAB  = 8
const ALL_SLUG = "__all__"

const TABS = [
  { slug: ALL_SLUG, name: "All" },
  ...HOMEPAGE_CATEGORIES.map(c => ({ slug: c.slug, name: c.name })),
]

export function CategoryListings() {
  const router = useRouter()
  const [activeSlug, setActiveSlug] = useState(ALL_SLUG)
  const [cache,      setCache]      = useState<Record<string, Listing[]>>({})
  const [loading,    setLoading]    = useState(false)

  const fetchCategory = useCallback(async (slug: string) => {
    if (cache[slug] !== undefined) return
    setLoading(true)
    try {
      const constraints =
        slug === ALL_SLUG
          ? [
              where("status",    "==", "active"),
              where("isActive",  "==", true),
              orderBy("createdAt", "desc"),
              limit(PER_TAB),
            ]
          : [
              where("status",      "==", "active"),
              where("isActive",    "==", true),
              where("categorySlug","==", slug),
              orderBy("isBoosted", "desc"),
              orderBy("createdAt", "desc"),
              limit(PER_TAB),
            ]

      const snap = await AdminService.getCollection("listings", constraints)
      setCache(prev => ({ ...prev, [slug]: snap.map((d: any) => d as unknown as Listing) }))
    } catch {
      setCache(prev => ({ ...prev, [slug]: [] }))
    }
    setLoading(false)
  }, [cache])

  useEffect(() => { fetchCategory(activeSlug) }, [activeSlug])

  const activeName = TABS.find(t => t.slug === activeSlug)?.name ?? ""
  const listings   = cache[activeSlug] ?? []

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">Shop by Category</h2>
        {activeSlug !== ALL_SLUG ? (
          <Link
            href={`/search?category=${activeSlug}`}
            className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
          >
            See all {activeName} <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <Link
            href="/search"
            className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
          >
            Browse all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {/* Category tabs — scrollable, all 16 homepage categories */}
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : listings.length === 0 ? (
        // ── Proper empty state — never a blank or 404 ──────────────────────
        <div className="flex flex-col items-center justify-center py-14 gap-4 rounded-2xl border border-dashed border-border bg-muted/20 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {activeSlug === ALL_SLUG
                ? "Be the first to list on Zamorax!"
                : `No ${activeName} listings yet`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeSlug === ALL_SLUG
                ? "We're just getting started. Post your item and reach thousands of buyers."
                : `Be the first seller in ${activeName}. It's free to list.`}
            </p>
          </div>
          <Button
            onClick={() => router.push("/dashboard/seller/post")}
            className="bg-primary text-white hover:bg-primary/90 gap-2"
            size="sm"
          >
            <Zap className="h-3.5 w-3.5" />
            Post a Free Ad
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {listings.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>
          {listings.length >= PER_TAB && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs"
              >
                <Link href={activeSlug === ALL_SLUG ? "/search" : `/search?category=${activeSlug}`}>
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
