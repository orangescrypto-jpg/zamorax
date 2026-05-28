// src/services/blog.ts
// ─────────────────────────────────────────────────────────────────
// Blog service — public interface + provider switch
// ─────────────────────────────────────────────────────────────────

import type { BlogPost, BlogFilters, PaginatedBlogResult } from "@/src/types/blog"

// ── Switch provider here ─────────────────────────────────────────
export { BlogService } from "@/src/services/providers/firebase/blog"
// ─────────────────────────────────────────────────────────────────

export interface IBlogService {
  getPosts(filters?: BlogFilters, cursor?: unknown): Promise<PaginatedBlogResult>
  getPostBySlug(slug: string): Promise<BlogPost | null>
  getPostById(id: string): Promise<BlogPost | null>
  getLatestPosts(count: number): Promise<BlogPost[]>
  createPost(data: Omit<BlogPost, "id" | "createdAt" | "updatedAt" | "views">): Promise<{ id: string }>
  updatePost(id: string, data: Partial<BlogPost>): Promise<void>
  deletePost(id: string): Promise<void>
  incrementViews(id: string): Promise<void>
}
