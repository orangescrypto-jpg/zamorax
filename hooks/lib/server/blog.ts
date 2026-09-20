// lib/server/blog.ts
// Server-only: fetch ONE published blog post by slug straight from D1.
//
// Why this exists: the generic BlogService swallows database errors and returns "not found".
// On an ISR page that means a brief D1 outage gets cached as a 404 for real posts.
// Here, `null` means the query succeeded and there is no such post; any DB failure THROWS,
// so Next.js keeps serving the last good copy (or returns a retryable 5xx) instead of
// caching a 404.

import { cache } from "react"
import { d1Query } from "@/lib/d1"
import type { BlogPost } from "@/src/types/blog"

function parseTags(v: unknown): string[] {
  try {
    const t = v ? JSON.parse(String(v)) : []
    return Array.isArray(t) ? t.map(String) : []
  } catch {
    return []
  }
}

// React cache(): generateMetadata() and the page both call this per request,
// so it results in one query, not two.
export const getPublishedPostBySlug = cache(async (slug: string): Promise<BlogPost | null> => {
  if (!slug || slug.length > 200) return null

  let result: unknown
  try {
    result = await d1Query(
      "SELECT * FROM blog WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug],
    )
  } catch (err: any) {
    // Brand-new database without the blog table yet: genuinely "no such post".
    if (/no such table/i.test(String(err?.message))) return null
    throw err
  }

  const row = ((result as any)?.results ?? [])[0] as Record<string, unknown> | undefined
  if (!row) return null

  return {
    id:          String(row.id),
    title:       String(row.title ?? ""),
    slug:        String(row.slug ?? ""),
    excerpt:     String(row.excerpt ?? ""),
    content:     String(row.content ?? ""),
    coverImage:  String(row.cover_image ?? ""),
    category:    String(row.category ?? ""),
    tags:        parseTags(row.tags),
    authorId:    String(row.author_id ?? ""),
    authorName:  String(row.author_name ?? ""),
    authorRole:  row.author_role === "moderator" ? "moderator" : "admin",
    status:      "published",
    views:       Number(row.views ?? 0),
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt:   String(row.created_at ?? new Date().toISOString()),
    updatedAt:   String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  }
})
