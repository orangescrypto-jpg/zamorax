// app/sitemap.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
import { AdminService } from "@/src/services/admin"
import { BlogService } from "@/src/services/blog"
import type { MetadataRoute } from "next"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"
  const now  = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/listings`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/flash-deals`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/rentals`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/free-delivery`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/group-buy`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/zamorax-direct`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/disclaimer`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  let listingRoutes: MetadataRoute.Sitemap = []
  try {
    const listings = await AdminService.getCollection("listings") as { id: string; updated_at?: string; updatedAt?: string }[]
    listingRoutes = listings
      .filter(l => (l as any).is_active || (l as any).isActive)
      .slice(0, 5000)
      .map(l => ({
        url: `${base}/listings/${l.id}`,
        lastModified: new Date(l.updated_at ?? l.updatedAt ?? now),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))
  } catch {
    // no-op — listings block is optional
  }

  let blogRoutes: MetadataRoute.Sitemap = []
  try {
    const { items: posts } = await BlogService.getPosts({ status: "published" })
    blogRoutes = posts.map(p => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? p.publishedAt ?? now),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }))
  } catch {
    // no-op — blog block is optional
  }

  return [...staticRoutes, ...listingRoutes, ...blogRoutes]
}
