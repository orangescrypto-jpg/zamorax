"use client"
// app/(moderator)/moderator/blog/page.tsx
// Moderators can only see and manage their own posts.

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Clock, Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/useAuth"
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

export default function ModeratorBlogPage() {
  const { user }        = useAuth()
  const router          = useRouter()
  const { toast }       = useToast()
  const [posts, setPosts]       = useState<BlogPost[]>([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch]     = useState("")

  useEffect(() => {
    if (!user?.uid) return
    BlogService.getPosts({ authorId: user.uid })
      .then(r => setPosts(r.items))
      .catch(() => toast({ title: "Failed to load posts", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [user?.uid])

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"?`)) return
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
      toast({ title: newStatus === "published" ? "Post published ✅" : "Unpublished" })
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
          <h1 className="text-xl font-bold text-white">My Blog Posts</h1>
          <p className="text-white/40 text-sm mt-0.5">{posts.length} posts</p>
        </div>
        <Link href="/moderator/blog/new">
          <Button className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl gap-2">
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search your posts…"
          className="pl-10 bg-secondary border-white/10 text-white placeholder:text-white/30 rounded-xl"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-secondary border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <p className="font-medium">No posts yet</p>
          <Link href="/moderator/blog/new" className="text-primary text-sm mt-2 inline-block">
            Write your first post →
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
                <div className="flex items-center gap-1 text-white/30 text-xs mt-0.5">
                  <Clock className="h-3 w-3" /> {formatDate(post.createdAt)}
                  <span className="mx-1">·</span>
                  <Eye className="h-3 w-3" /> {post.views} views
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleStatus(post)}
                  title={post.status === "published" ? "Unpublish" : "Publish"}
                  className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {post.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <Link href={`/moderator/blog/${post.id}/edit`}>
                  <button className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                </Link>
                <button
                  onClick={() => handleDelete(post)}
                  disabled={deleting === post.id}
                  className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {deleting === post.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
