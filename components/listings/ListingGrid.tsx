"use client"

import type { Listing } from "@/src/types"
import { ListingCard } from "./ListingCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface ListingGridProps {
  listings: Listing[]
  loading?: boolean
  error?: string | null
  emptyMessage?: string
}

export function ListingGrid({ listings, loading, error, emptyMessage }: ListingGridProps) {
  if (error) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-destructive font-medium">Failed to load listings.</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[320px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="py-12 text-center space-y-4 bg-muted/30 rounded-xl border border-dashed border-border/50">
        <p className="text-muted-foreground font-medium">{emptyMessage || "No listings match your filters."}</p>
        <Button variant="outline" asChild>
          <Link href="/search">Clear Filters</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
