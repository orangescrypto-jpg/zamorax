"use client"
// app/(admin)/admin/blog/new/page.tsx

import { useAuth } from "@/hooks/useAuth"
import { BlogPostForm } from "@/components/blog/BlogPostForm"
import { Loader2 } from "lucide-react"

export default function AdminNewBlogPostPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <BlogPostForm
      authorId={user.uid}
      authorName={user.fullName || user.username}
      authorRole="admin"
      backHref="/admin/blog"
    />
  )
}
