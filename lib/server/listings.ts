// lib/server/listings.ts
// Server-only helper: fetch active listings straight from D1 so pages can be
// rendered with real products in the initial HTML (what Googlebot indexes),
// instead of an empty grid that only fills in after client-side fetches.
//
// Returns `null` on failure (NOT []), so callers can fall back to the client
// fetch instead of telling Google "no listings found".

import { d1Query } from "@/lib/d1"
import { mapListingRow } from "@/src/services/providers/cloudflare/listings"
import type { Listing } from "@/src/types"

interface Opts {
  category?: string   // category slug
  official?: boolean  // Zamorax Direct only
  limit?: number      // 1–40, default 12
}

// Tiny per-instance cache so crawler bursts don't hammer the D1 HTTP API.
const TTL_MS = 60_000
const cache = new Map<string, { at: number; data: Listing[] }>()

export async function getActiveListingsServer(opts: Opts = {}): Promise<Listing[] | null> {
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 40)
  const key = JSON.stringify([opts.category ?? "", !!opts.official, limit])
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data

  // Mirrors app/api/listings/route.ts so server and client show the same items.
  const where: string[] = ["status = 'active'"]
  const params: unknown[] = []
  if (opts.category) { where.push("category = ?"); params.push(opts.category) }
  if (opts.official) {
    where.push("(seller_id IN (SELECT uid FROM users WHERE is_official = 1) OR is_zamorax_pick = 1)")
  }

  const sql = `
    SELECT listings.*,
           (SELECT is_official FROM users WHERE users.uid = listings.seller_id) AS is_official_seller
    FROM listings
    WHERE ${where.join(" AND ")}
    ORDER BY is_boosted DESC, created_at DESC
    LIMIT ${limit}
  `

  try {
    const result = await d1Query(sql, params)
    const rows = ((result as any)?.results ?? []) as Record<string, unknown>[]
    const data: Listing[] = rows.map(row => ({
      ...mapListingRow(row),
      isZamoraxPick: !!row.is_zamorax_pick,
      isOfficial: !!row.is_official_seller || !!row.is_zamorax_pick,
      // Cards don't need these, and they'd bloat the HTML/RSC payload.
      description: "",
      attributes: {},
    }))
    cache.set(key, { at: Date.now(), data })
    return data
  } catch (err) {
    console.error("[getActiveListingsServer]", err)
    return null
  }
}
