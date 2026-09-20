// app/(public)/blog/[slug]/BlogPostExtras.tsx
"use client"
// Browser-only bits of the blog post page: view counter + related posts.
// Kept out of page.tsx so the article itself is server-rendered for SEO.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye } from "lucide-react"
import type { BlogPost } from "@/src/types/blog"
import { blogCoverImage } from "@/constants/blog"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
}

interface Props {
  postId: string
  category: string
  initialViews: number
  part: "views" | "related"
}

export function BlogPostExtras({ postId, category, initialViews, part }: Props) {
  const [related, setRelated] = useState<BlogPost[]>([])

  // Count the view once per mount (only from the "views" instance so the
  // second instance on the page doesn't double-count).
  useEffect(() => {
    if (part !== "views") return
    fetch(`/api/blog/${postId}/views`, { method: "POST" }).catch(() => {})
  }, [postId, part])

  useEffect(() => {
    if (part !== "related") return
    fetch(`/api/blog?limit=6`)
      .then(r => r.json())
      .then(d =>
        setRelated(
          ((d.posts ?? []) as BlogPost[])
            .filter(r => r.id !== postId && r.category === category)
            .slice(0, 3),
        ),
      )
      .catch(() => {})
  }, [postId, category, part])

  if (part === "views") {
    return (
      <span className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        {initialViews.toLocaleString()} views
      </span>
    )
  }

  if (related.length === 0) return null

  return (
    <section className="space-y-4 pt-4 border-t border-gray-100">
      <h2 className="text-gray-900 font-bold">Related Articles</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {related.map(r => (
          <Link
            key={r.id}
            href={`/blog/${r.slug}`}
            className="group block rounded-xl overflow-hidden bg-gray-50 border border-gray-200 hover:border-primary/30 transition-all"
          >
            <div className="h-32 overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blogCoverImage(r.coverImage)}
                alt={r.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={e => { (e.target as HTMLImageElement).src = blogCoverImage(null) }}
              />
            </div>
            <div className="p-3">
              <p className="text-gray-900 text-xs font-semibold line-clamp-2 group-hover:text-primary transition-colors">{r.title}</p>
              <p className="text-gray-400 text-xs mt-1">{formatDate(r.publishedAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
