// app/(public)/blog/page.tsx
// app/(public)/blog/page.tsx — SERVER component (was "use client" + useEffect fetch).
import type { Metadata } from "next"
import { BlogService } from "@/src/services/blog"
import BlogIndexClient from "@/components/blog/BlogIndexClient"

export const revalidate = 300

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"

export const metadata: Metadata = {
  title: "Blog — Tips, Guides & News for Buying and Selling in Nigeria",
  description:
    "Practical guides, safety tips, seller stories and marketplace news to help you buy and sell smarter on Zamorax.",
  alternates: { canonical: `${BASE}/blog` }, // ?tag= / ?category= variants all canonicalise here
  openGraph: { type: "website", url: `${BASE}/blog`, title: "Zamorax Blog", siteName: "Zamorax", locale: "en_NG" },
}

export default async function BlogPage() {
  let initialPosts: Awaited<ReturnType<typeof BlogService.getPosts>>["items"] = []
  try {
    const { items } = await BlogService.getPosts({ status: "published" })
    // Strip the full HTML body: the index only needs card fields, and sending every
    // article's content to the browser would balloon the page payload.
    initialPosts = items.map(p => ({ ...p, content: "" }))
  } catch {
    /* fall back to the client fetch */
  }
  return <BlogIndexClient initialPosts={initialPosts} />
}
