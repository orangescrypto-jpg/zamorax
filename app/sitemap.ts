// app/sitemap.ts
import { AdminService } from "@/src/services/admin"
import { BlogService } from "@/src/services/blog"
import { getActiveCategories } from "@/constants/categories"
import { getSubSettings } from "@/src/services/subSettings"
import type { MetadataRoute } from "next"

// Regenerate at most once an hour instead of hitting D1 on every crawler request.
export const revalidate = 3600

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"

// Google's hard limit is 50,000 URLs / 50MB per sitemap file.
const MAX_LISTINGS = 40_000

function safeDate(v: unknown, fallback: Date): Date {
  if (!v) return fallback
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? fallback : d
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Only pages that (a) exist, (b) are indexable, (c) return real content.
  // lastModified is omitted on static pages on purpose: Google ignores
  // lastmod values that always equal "now", so lying here just hurts trust.
  // changeFrequency/priority are ignored by Google, so they're dropped too.
  const staticPaths = [
    "", "/categories", "/blog", "/how-it-works", "/pricing",
    "/safety", "/about", "/contact", "/terms", "/privacy", "/cookies",
    "/disclaimer",
  ]
  // Deliberately NOT listed: /search and /zamorax-direct (the latter just redirects to
  // a /search?… URL that robots.txt blocks), and the transient client-rendered pages
  // /flash-deals, /group-buy, /rentals, /free-delivery — they're crawlable via links but
  // are thin until they're server-rendered, and submitting them just invites soft-404s.
  const staticRoutes: MetadataRoute.Sitemap = staticPaths.map(p => ({ url: `${BASE}${p}` }))

  const subSettings = await getSubSettings()
  const categoryRoutes: MetadataRoute.Sitemap = getActiveCategories(subSettings.disabledCategorySlugs).map(c => ({
    url: `${BASE}/categories/${c.slug}`,
  }))

  let listingRoutes: MetadataRoute.Sitemap = []
  try {
    // FIX: the listings table has NO is_active column — it uses `status`.
    // The old filter (l.is_active || l.isActive) was always falsy, so zero
    // listings were ever emitted. Filter in SQL, newest first, and cap.
    const rows = (await AdminService.getCollection("listings", [
      { field: "status", op: "==", value: "active" },
      { field: "updated_at", dir: "desc" },
      { limit: MAX_LISTINGS },
    ])) as Array<Record<string, any>>

    // getCollection swallows its own D1 errors and returns [] on failure
    // (see AdminService.getCollection), so a genuine query break — a typo'd
    // column, a schema change — looks identical to "there are truly zero
    // active listings" from here, and the catch block below would never
    // fire to log it. That's exactly the shape of bug this filter itself
    // used to have (is_active never matching anything). Surface it loudly
    // instead of letting the sitemap go quietly, permanently empty again.
    if (rows.length === 0) {
      console.error("[sitemap] listings query returned 0 rows — check AdminService.getCollection isn't silently failing")
    }

    listingRoutes = rows
      // Zamorax Direct picks are hidden from normal views; still fine to
      // index via their own canonical URL, so they are kept.
      .filter(l => l.id)
      .map(l => ({
        url: `${BASE}/listings/${l.id}`,
        lastModified: safeDate(l.updatedAt ?? l.createdAt, now),
      }))
  } catch (err) {
    console.error("[sitemap] listings failed:", err)
  }

  let blogRoutes: MetadataRoute.Sitemap = []
  try {
    // FIX: BlogService.getPosts() silently caps at PAGE_SIZE (12 posts) —
    // fine for a paginated admin/public list, but it meant every published
    // post past the 12 most recent was permanently missing from the
    // sitemap. getAllPublishedSlugs() returns every published post, unpaginated.
    const posts = await BlogService.getAllPublishedSlugs()
    blogRoutes = posts
      .filter(p => p.slug)
      .map(p => ({
        url: `${BASE}/blog/${p.slug}`,
        lastModified: safeDate(p.updatedAt ?? p.publishedAt, now),
      }))
  } catch (err) {
    console.error("[sitemap] blog failed:", err)
  }

  return [...staticRoutes, ...categoryRoutes, ...listingRoutes, ...blogRoutes]
}
