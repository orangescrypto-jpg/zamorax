// components/home/LatestListingsServer.tsx
// components/home/LatestListingsServer.tsx — SERVER component (no "use client").
// Real, visible "Just listed" products rendered into the initial HTML, so Google
// finds crawlable /listings/[id] links on the homepage without running any JS.
import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"
import { ListingCard } from "@/components/listings/ListingCard"
import { getActiveListingsServer } from "@/lib/server/listings"

export async function LatestListingsServer() {
  const listings = await getActiveListingsServer({ limit: 12 })
  if (!listings || listings.length === 0) return null // never show an "empty" state to crawlers

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-bold text-foreground">Just Listed</h2>
        </div>
        <Link href="/search" className="text-xs text-primary font-medium flex items-center gap-0.5">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {listings.map(l => <ListingCard key={l.id} listing={l} />)}
      </div>
    </section>
  )
}
