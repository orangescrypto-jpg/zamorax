import type { MetadataRoute } from "next"
import { getApp, getApps, initializeApp, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const BASE_URL = "https://zamorax.com"

function getDb() {
  const app = !getApps().length
    ? initializeApp({ credential: cert({
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      })})
    : getApp()
  return getFirestore(app)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL,                       lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE_URL}/listings`,         lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/search`,           lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE_URL}/blog`,             lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE_URL}/how-it-works`,     lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/safety`,           lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/pricing`,          lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`,          lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/register`,         lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/login`,            lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/terms`,            lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/privacy`,          lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE_URL}/escrow-agreement`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ]

  // Dynamic listings + blog pages
  let listingPages: MetadataRoute.Sitemap = []
  let blogPages:    MetadataRoute.Sitemap = []

  try {
    const db = getDb()

    // Fetch active listings (limit 1000 for sitemap)
    const listingsSnap = await db
      .collection("listings")
      .where("status", "==", "active")
      .limit(1000)
      .get()

    listingPages = listingsSnap.docs.map(doc => {
      const data = doc.data()
      const updatedAt = data.updatedAt?.toDate?.() ?? now
      return {
        url: `${BASE_URL}/listings/${doc.id}`,
        lastModified: updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }
    })

    // Fetch published blog posts
    const blogSnap = await db
      .collection("blog")
      .where("status", "==", "published")
      .limit(500)
      .get()

    blogPages = blogSnap.docs.map(doc => {
      const data = doc.data()
      const updatedAt = data.updatedAt?.toDate?.() ?? now
      return {
        url: `${BASE_URL}/blog/${data.slug ?? doc.id}`,
        lastModified: updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }
    })
  } catch {
    // Sitemap still works even if DB is unreachable at build time
  }

  return [...staticPages, ...listingPages, ...blogPages]
}
