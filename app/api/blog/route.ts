// app/api/blog/route.ts
// Public endpoint — no auth required. Returns published blog posts for homepage/blog page.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function mapRow(row: Record<string, unknown>) {
  let tags: string[] = []
  try { tags = JSON.parse(row.tags as string ?? "[]") } catch { tags = [] }

  return {
    id:          String(row.id ?? ""),
    title:       String(row.title ?? ""),
    slug:        String(row.slug ?? ""),
    excerpt:     String(row.excerpt ?? ""),
    content:     String(row.content ?? ""),
    coverImage:  String(row.cover_image ?? ""),
    category:    String(row.category ?? ""),
    tags,
    authorId:    String(row.author_id ?? ""),
    authorName:  String(row.author_name ?? ""),
    authorRole:  String(row.author_role ?? "admin"),
    status:      String(row.status ?? "published"),
    views:       Number(row.views ?? 0),
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt:   String(row.created_at ?? ""),
    updatedAt:   String(row.updated_at ?? ""),
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const { searchParams } = new URL(req.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? "6"), 20)
  const slug  = searchParams.get("slug")

  try {
    if (slug) {
      // Single post by slug
      const result = await d1Query(
        `SELECT * FROM blog WHERE slug = ? AND status = 'published' LIMIT 1`,
        [slug],
        nativeDB,
      )
      const rows = (result as any)?.results ?? []
      if (!rows.length) return NextResponse.json({ post: null }, { status: 404 })
      return NextResponse.json({ post: mapRow(rows[0]) })
    }

    // Latest published posts
    const result = await d1Query(
      `SELECT id, title, slug, excerpt, cover_image, category, tags, author_name, author_role, views, published_at, created_at, updated_at
       FROM blog
       WHERE status = 'published'
       ORDER BY published_at DESC, created_at DESC
       LIMIT ?`,
      [limit],
      nativeDB,
    )
    const posts = ((result as any)?.results ?? []).map((r: any) => mapRow(r))
    return NextResponse.json({ posts })
  } catch (err: any) {
    console.error("[api/blog]", err)
    return NextResponse.json({ posts: [], post: null })
  }
}
