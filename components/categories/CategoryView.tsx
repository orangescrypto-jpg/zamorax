"use client"

import { useListings } from "@/hooks/useListings"
import { ListingGrid } from "@/components/listings/ListingGrid"
import { ListingFilter } from "@/components/listings/ListingFilter"
import { CategoryConfig } from "@/constants/categories"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldCheck, Phone } from "lucide-react"
import type { Listing } from "@/src/types"

export function CategoryView({ category }: { category: CategoryConfig }) {
  const { listings, loading, error } = useListings({ category: category.slug })

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
            emptyMessage={`No active ${category.name} listings found. Be the first to post one!`}
          />
        </div>
      </div>
    </div>
  )
}
