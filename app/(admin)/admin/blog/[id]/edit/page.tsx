"use client"
// app/(admin)/admin/blog/[id]/edit/page.tsx

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { BlogService } from "@/src/services/blog"
import { BlogPostForm } from "@/components/blog/BlogPostForm"
import type { BlogPost } from "@/src/types/blog"

export default function AdminEditBlogPostPage() {
  const { id }          = useParams<{ id: string }>()
  const router          = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    BlogService.getPostById(id)
      .then(p => {
        if (!p) { router.replace("/admin/blog"); return }
        setPost(p)
      })
      .catch(() => router.replace("/admin/blog"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!post || !user) return null

  return (
    <BlogPostForm
      initial={post}
      authorId={user.uid}
      authorName={user.fullName || user.username}
      authorRole="admin"
      backHref="/admin/blog"
    />
  )
}
