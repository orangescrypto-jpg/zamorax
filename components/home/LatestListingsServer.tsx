// components/home/LatestListingsServer.tsx
// components/home/LatestListingsServer.tsx — SERVER component (no "use client").
// Real, visible "Just listed" products rendered into the initial HTML, so Google
// finds crawlable /listings/[id] links on the homepage without running any JS.
import Link from "next/link"
import { getActiveListingsServer } from "@/lib/server/listings"
import { getSubSettings } from "@/src/services/subSettings"

// Renders nothing visible — its only job is to put real, crawlable
// /listings/[id] links into the initial server-rendered HTML for Google,
// since the visible "Shop by Category" grid below it is a client component
// ("use client" in CategoryListings.tsx) and won't be in that HTML. Was
// previously a full duplicate "Just Listed" card section, which (a) repeated
// what the "All" tab of Shop by Category already shows, and (b) had no
// category gating, so a listing in an admin-disabled category could still
// surface here even though it's hidden everywhere else. Both fixed by
// filtering against disabledCategorySlugs and dropping the visible cards.
export async function LatestListingsServer() {
  const [listings, subSettings] = await Promise.all([
    getActiveListingsServer({ limit: 24 }), // fetch extra; some get filtered out below
    getSubSettings(),
  ])
  if (!listings || listings.length === 0) return null

  const disabled = new Set(subSettings.disabledCategorySlugs)
  const visible = listings.filter(l => !disabled.has(l.category)).slice(0, 12)
  if (visible.length === 0) return null

  return (
    <div className="sr-only" aria-hidden="true">
      {visible.map(l => <Link key={l.id} href={`/listings/${l.id}`}>{l.title}</Link>)}
    </div>
  )
}
