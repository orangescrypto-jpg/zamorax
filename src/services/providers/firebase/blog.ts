// src/services/providers/firebase/blog.ts
// ─────────────────────────────────────────────────────────────────
// Firebase provider for BlogService
// ─────────────────────────────────────────────────────────────────

import {
  collection, query, where, orderBy, limit, startAfter,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, increment, DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IBlogService } from "@/src/services/blog"
import type { BlogPost, BlogFilters, PaginatedBlogResult } from "@/src/types/blog"

// ── Helpers ──────────────────────────────────────────────────────

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (ts?.toDate) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

// Explicitly map every field so nothing is silently undefined
function mapPost(id: string, data: DocumentData): BlogPost {
  return {
    id,
    title:      data.title      ?? "",
    slug:       data.slug       ?? "",
    excerpt:    data.excerpt    ?? "",
    content:    data.content    ?? "",
    coverImage: data.coverImage ?? "",
    category:   data.category   ?? "",
    tags:       Array.isArray(data.tags) ? data.tags : [],
    authorId:   data.authorId   ?? "",
    authorName: data.authorName ?? "",
    authorRole: data.authorRole ?? "admin",
    status:     data.status     ?? "draft",
    views:      typeof data.views === "number" ? data.views : 0,
    publishedAt: data.publishedAt ? toIso(data.publishedAt) : null,
    createdAt:  toIso(data.createdAt),
    updatedAt:  toIso(data.updatedAt),
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80)
}

// ── Implementation ───────────────────────────────────────────────

export const BlogService: IBlogService = {

  async getPosts(filters: BlogFilters = {}, cursor?: unknown): Promise<PaginatedBlogResult> {
    const PAGE_SIZE = 12
    const constraints: QueryConstraint[] = [
      where("status", "==", filters.status ?? "published"),
      orderBy("publishedAt", "desc"),
      limit(PAGE_SIZE),
    ]

    if (filters.category) constraints.unshift(where("category", "==", filters.category))
    if (filters.authorId) constraints.unshift(where("authorId", "==", filters.authorId))
    if (filters.tag) constraints.unshift(where("tags", "array-contains", filters.tag))

    const q = cursor
      ? query(collection(db, "blogPosts"), ...constraints, startAfter(cursor))
      : query(collection(db, "blogPosts"), ...constraints)

    const snap = await getDocs(q)
    return {
      items: snap.docs.map(d => mapPost(d.id, d.data())),
      nextCursor: snap.docs[snap.docs.length - 1] ?? null,
      hasMore: snap.docs.length === PAGE_SIZE,
    }
  },

  async getPostBySlug(slug: string, opts?: { allowDraft?: boolean }): Promise<BlogPost | null> {
    const constraints: QueryConstraint[] = [where("slug", "==", slug), limit(1)]
    // Public pages only see published posts; admin/edit pages pass allowDraft: true
    if (!opts?.allowDraft) {
      constraints.unshift(where("status", "==", "published"))
    }
    const q = query(collection(db, "blogPosts"), ...constraints)
    const snap = await getDocs(q)
    if (snap.empty) return null
    return mapPost(snap.docs[0].id, snap.docs[0].data())
  },

  async getPostById(id: string): Promise<BlogPost | null> {
    const snap = await getDoc(doc(db, "blogPosts", id))
    if (!snap.exists()) return null
    return mapPost(snap.id, snap.data())
  },

  async getLatestPosts(count: number): Promise<BlogPost[]> {
    const q = query(
      collection(db, "blogPosts"),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
      limit(count)
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => mapPost(d.id, d.data()))
  },

  async createPost(data: Omit<BlogPost, "id" | "createdAt" | "updatedAt" | "views">): Promise<{ id: string }> {
    // Respect existing slug if provided, only generate if absent
    const slug = data.slug?.trim() || slugify(data.title)
    const ref = await addDoc(collection(db, "blogPosts"), {
      ...data,
      slug,
      views: 0,
      publishedAt: data.status === "published" ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: ref.id }
  },

  async updatePost(id: string, data: Partial<BlogPost>): Promise<void> {
    // Strip undefined values — Firestore will wipe existing fields if passed undefined
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    )
    const updateData: Record<string, unknown> = {
      ...clean,
      updatedAt: serverTimestamp(),
    }
    // Only set publishedAt when first publishing
    if (data.status === "published") {
      const existing = await getDoc(doc(db, "blogPosts", id))
      if (existing.exists() && !existing.data().publishedAt) {
        updateData.publishedAt = serverTimestamp()
      }
    }
    await updateDoc(doc(db, "blogPosts", id), updateData)
  },

  async deletePost(id: string): Promise<void> {
    await deleteDoc(doc(db, "blogPosts", id))
  },

  async incrementViews(id: string): Promise<void> {
    await updateDoc(doc(db, "blogPosts", id), {
      views: increment(1),
    })
  },
}
