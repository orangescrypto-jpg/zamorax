"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Loader2,
  Clock, User, Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { BlogService } from "@/src/services/blog"
import type { BlogPost, BlogStatus } from "@/src/types/blog"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  })
}

const STATUS_COLORS: Record<BlogStatus, string> = {
  published: "bg-emerald-500/20 text-emerald-400",
  draft:     "bg-yellow-500/20 text-yellow-400",
}

export default function AdminBlogPage() {
  const router          = useRouter()
  const { toast }       = useToast()
  const [posts, setPosts]         = useState<BlogPost[]>([])
  const [loading, setLoading]     = useState(true)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [filter, setFilter]       = useState<BlogStatus | "all">("all")
  const [search, setSearch]       = useState("")
  const [cursor, setCursor]       = useState<unknown>(null)
  const [hasMore, setHasMore]     = useState(false)
  const [loadingMore, setLoadMore] = useState(false)

  async function fetchPosts(reset = true) {
    if (reset) setLoading(true)
    else setLoadMore(true)
    try {
      const filters = filter !== "all" ? { status: filter as BlogStatus } : {}
      const result  = await BlogService.getPosts(filters, reset ? undefined : cursor)
      setPosts(prev => reset ? result.items : [...prev, ...result.items])
      setCursor(result.nextCursor)
      setHasMore(result.hasMore)
    } catch {
      toast({ title: "Failed to load posts", variant: "destructive" })
    } finally {
      setLoading(false)
      setLoadMore(false)
    }
  }

  useEffect(() => { fetchPosts(true) }, [filter])

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    setDeleting(post.id)
    try {
      await BlogService.deletePost(post.id)
      setPosts(p => p.filter(x => x.id !== post.id))
      toast({ title: "Post deleted" })
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  async function handleToggleStatus(post: BlogPost) {
    const newStatus: BlogStatus = post.status === "published" ? "draft" : "published"
    try {
      await BlogService.updatePost(post.id, { status: newStatus })
      setPosts(p => p.map((x: any) => x.id === post.id ? { ...x, status: newStatus } : x))
      toast({ title: newStatus === "published" ? "Post published ✅" : "Post unpublished" })
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" })
    }
  }

  const displayed = search
    ? posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : posts

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Blog Posts</h1>
          <p className="text-white/40 text-sm mt-0.5">{posts.length} total posts</p>
        </div>
        <Link href="/admin/blog/new">
          <Button className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl gap-2">
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="pl-10 bg-secondary border-white/10 text-white placeholder:text-white/30 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "published", "draft"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all
                ${filter === f ? "bg-primary text-white" : "bg-secondary text-white/50 hover:text-white border border-white/10"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-secondary border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <p className="font-medium">No posts found</p>
          <Link href="/admin/blog/new" className="text-primary text-sm mt-2 inline-block">
            Create your first post →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(post => (
            <div
              key={post.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary border border-white/5 hover:border-white/10 transition-all"
            >
              {post.coverImage ? (
                <div className="flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden bg-white/5">
                  <img src={post.coverImage} alt="" className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                </div>
              ) : (
                <div className="flex-shrink-0 w-16 h-12 rounded-lg bg-white/5" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[post.status]}`}>
                    {post.status}
                  </span>
                  <span className="text-white/30 text-[10px]">{post.category}</span>
                </div>
                <p className="text-white font-semibold text-sm truncate">{post.title}</p>
                <div className="flex items-center gap-3 text-white/30 text-xs mt-0.5">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {post.authorName}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(post.createdAt)}</span>
                  <span><Eye className="h-3 w-3 inline mr-0.5" />{post.views}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleToggleStatus(post)}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                  {post.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <Link href={`/admin/blog/${post.id}/edit`}>
                  <button className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                </Link>
                <button onClick={() => handleDelete(post)} disabled={deleting === post.id}
                  className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  {deleting === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => fetchPosts(false)} disabled={loadingMore}
                className="border-white/10 text-white hover:bg-white/5">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
