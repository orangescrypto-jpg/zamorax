// src/services/providers/cloudflare/blog.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { IBlogService } from "@/src/services/blog"
import type { BlogPost, BlogFilters, PaginatedBlogResult } from "@/src/types/blog"

const PAGE_SIZE = 12

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80)
}

function mapRow(row: Record<string, unknown>): BlogPost {
  const parse = (v: unknown) => { try { return v ? JSON.parse(v as string) : [] } catch { return [] } }
  return {
    id:          String(row.id),
    title:       String(row.title       ?? ""),
    slug:        String(row.slug        ?? ""),
    excerpt:     String(row.excerpt     ?? ""),
    content:     String(row.content     ?? ""),
    coverImage:  String(row.cover_image ?? row.coverImage ?? ""),
    category:    String(row.category    ?? ""),
    tags:        parse(row.tags),
    authorId:    String(row.author_id   ?? row.authorId   ?? ""),
    authorName:  String(row.author_name ?? row.authorName ?? ""),
    authorRole:  String(row.author_role ?? row.authorRole ?? "admin"),
    status:      String(row.status      ?? "draft"),
    views:       Number(row.views ?? 0),
    publishedAt: row.published_at ? String(row.published_at) : null,
    createdAt:   String(row.created_at ?? new Date().toISOString()),
    updatedAt:   String(row.updated_at ?? new Date().toISOString()),
  } as BlogPost
}

export const BlogService: IBlogService = {

  async getPosts(filters: BlogFilters = {}, _cursor?: unknown): Promise<PaginatedBlogResult> {
    const all = (await AdminService.getCollection("blog")) as Record<string, unknown>[]
    const status = filters.status ?? "published"
    let filtered = all.filter(r => String(r.status) === status)
    if (filters.category) filtered = filtered.filter(r => String(r.category) === filters.category)
    if (filters.authorId) filtered = filtered.filter(r => String(r.author_id ?? r.authorId) === filters.authorId)
    if (filters.tag) {
      filtered = filtered.filter(r => {
        try { const t = JSON.parse(r.tags as string ?? "[]"); return Array.isArray(t) && t.includes(filters.tag) }
        catch { return false }
      })
    }
    filtered.sort((a: any, b: any) => new Date(String(b.published_at ?? b.created_at ?? 0)).getTime() - new Date(String(a.published_at ?? a.created_at ?? 0)).getTime())
    const page = filtered.slice(0, PAGE_SIZE)
    return { items: page.map(mapRow), nextCursor: null, hasMore: filtered.length > PAGE_SIZE }
  },

  async getPostBySlug(slug, opts) {
    const all = (await AdminService.getCollection("blog")) as Record<string, unknown>[]
    const row = all.find(r => String(r.slug) === slug && (opts?.allowDraft || String(r.status) === "published"))
    return row ? mapRow(row) : null
  },

  async getPostById(id) {
    const row = await AdminService.getDoc("blog", id)
    return row ? mapRow(row as Record<string, unknown>) : null
  },

  async getLatestPosts(count) {
    const all = (await AdminService.getCollection("blog")) as Record<string, unknown>[]
    return all
      .filter(r => String(r.status) === "published")
      .sort((a: any, b: any) => new Date(String(b.published_at ?? b.created_at ?? 0)).getTime() - new Date(String(a.published_at ?? a.created_at ?? 0)).getTime())
      .slice(0, count)
      .map(mapRow)
  },

  async createPost(data) {
    const slug = data.slug?.trim() || slugify(data.title)
    return AdminService.addDoc("blog", {
      title:       data.title,
      slug,
      excerpt:     data.excerpt,
      content:     data.content,
      cover_image: data.coverImage,
      category:    data.category,
      tags:        JSON.stringify(data.tags ?? []),
      author_id:   data.authorId,
      author_name: data.authorName,
      author_role: data.authorRole ?? "admin",
      status:      data.status,
      views:       0,
      published_at: data.status === "published" ? new Date().toISOString() : null,
    })
  },

  async updatePost(id, data) {
    const patch: Record<string, unknown> = { ...data }
    if (data.tags)       patch.tags       = JSON.stringify(data.tags)
    if (data.coverImage) patch.cover_image = data.coverImage
    if (data.authorId)   patch.author_id   = data.authorId
    if (data.authorName) patch.author_name  = data.authorName
    if (data.status === "published") {
      const existing = await AdminService.getDoc("blog", id) as Record<string, unknown> | null
      if (existing && !existing.published_at) patch.published_at = new Date().toISOString()
    }
    delete patch.coverImage
    delete patch.authorId
    delete patch.authorName
    await AdminService.updateDoc("blog", id, patch)
  },

  async deletePost(id) {
    await AdminService.deleteDoc("blog", id)
  },

  async incrementViews(id) {
    const row = await AdminService.getDoc("blog", id) as Record<string, unknown> | null
    const current = row ? Number(row.views ?? 0) : 0
    await AdminService.updateDoc("blog", id, { views: current + 1 })
  },
}
