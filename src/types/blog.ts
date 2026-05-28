// src/types/blog.ts
// ─────────────────────────────────────────────────────────────────
// Blog post types — zero Firebase/Firestore imports.
// Timestamps are plain ISO strings.
// ─────────────────────────────────────────────────────────────────

export type BlogStatus = "draft" | "published"
export type BlogEditorMode = "visual" | "html"

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string          // HTML content (from either editor mode)
  coverImage: string       // External URL only
  category: string
  tags: string[]
  authorId: string
  authorName: string
  authorRole: "admin" | "moderator"
  status: BlogStatus
  views: number
  publishedAt: string | null  // ISO string
  createdAt: string           // ISO string
  updatedAt: string           // ISO string
}

export interface BlogFilters {
  category?: string
  status?: BlogStatus
  authorId?: string
  tag?: string
}

export interface PaginatedBlogResult {
  items: BlogPost[]
  nextCursor: unknown | null
  hasMore: boolean
}

export const BLOG_CATEGORIES = [
  "Company News",
  "Seller Tips",
  "Buyer Guide",
  "Safety & Trust",
  "Product Updates",
  "Market Trends",
  "How It Works",
  "Community",
] as const

export type BlogCategory = typeof BLOG_CATEGORIES[number]
