"use client"

import { useListings } from "@/hooks/useListings"
import { ListingGrid } from "@/components/listings/ListingGrid"
import { ListingFilter } from "@/components/listings/ListingFilter"
import { CategoryConfig } from "@/constants/categories"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Phone } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useEffect } from "react"
import type { Listing } from "@/src/types"

export function CategoryView({ category }: { category: CategoryConfig }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const officialOnly = searchParams.get("official") === "true"

  const { listings, loading, error, fetchListings } = useListings({
    category: category.slug,
    official: officialOnly,
  })

  // Re-fetch whenever the "official" URL param changes (e.g. toggled via
  // the button below or the sidebar checkbox in ListingFilter, which write
  // to the same param) — useListings only auto-fetches on mount otherwise.
  useEffect(() => {
    fetchListings({ category: category.slug, official: officialOnly }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officialOnly])

  const toggleOfficial = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (officialOnly) params.delete("official")
    else               params.set("official", "true")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="container py-8">
      {/* Category Hero */}
      <div className="mb-8 bg-card border rounded-2xl p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <Phone className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-heading font-bold">{category.name}</h1>
        <p className="text-muted-foreground">Browse verified {category.name} listings from trusted Nigerian sellers.</p>
      </div>

      {/* Trust Tip Banner */}
      <div className="mb-8">
        <Alert className="bg-emerald-50 border-emerald-300 text-emerald-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          <AlertTitle className="font-bold text-emerald-800">Zamorax Trust Tip</AlertTitle>
          <AlertDescription>{category.trustTip}</AlertDescription>
        </Alert>
      </div>

      {/* Zamorax Enterprises Direct toggle — visible inline on every
          category page (not hidden inside the mobile filter drawer),
          so buyers can jump straight to official-only listings in this
          category without duplicating the homepage's Direct section. */}
      <div className="mb-6">
        <Button
          variant={officialOnly ? "default" : "outline"}
          size="sm"
          onClick={toggleOfficial}
          className={officialOnly ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" : "gap-1.5"}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {officialOnly
            ? `Showing Zamorax Enterprises Direct ${category.name}`
            : `Zamorax Enterprises Direct ${category.name}`}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <ListingFilter />
        </div>

        {/* Results */}
        <div className="flex-1">
          <ListingGrid
            listings={listings as unknown as Listing[]}
            loading={loading}
            error={error}
            emptyMessage={
              officialOnly
                ? `No official Zamorax Enterprises ${category.name} listings yet.`
                : `No active ${category.name} listings found. Be the first to post one!`
            }
          />
        </div>
      </div>
    </div>
  )
}
