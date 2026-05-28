"use client"
// components/blog/BlogPostForm.tsx
// Shared form used by both /admin/blog/new and /admin/blog/[id]/edit
// Also used by moderator equivalents.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Save, Eye, ArrowLeft, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { BlogEditor } from "@/components/blog/BlogEditor"
import { BlogService } from "@/src/services/blog"
import type { BlogPost, BlogStatus } from "@/src/types/blog"

const CATEGORIES = [
  "News", "Tips & Guides", "Safety", "Seller Stories",
  "Product Updates", "Market Trends", "How It Works", "Announcements",
]

interface BlogPostFormProps {
  initial?: Partial<BlogPost>
  authorId: string
  authorName: string
  authorRole: "admin" | "moderator"
  backHref: string
}

export function BlogPostForm({
  initial, authorId, authorName, authorRole, backHref,
}: BlogPostFormProps) {
  const router    = useRouter()
  const { toast } = useToast()

  const [title,         setTitle]         = useState(initial?.title         ?? "")
  const [excerpt,       setExcerpt]       = useState(initial?.excerpt       ?? "")
  const [content,       setContent]       = useState(initial?.content       ?? "")
  const [coverImage, setCoverImageUrl] = useState(initial?.coverImage ?? "")
  const [category,      setCategory]      = useState(initial?.category      ?? CATEGORIES[0])
  const [tags,          setTags]          = useState<string[]>(initial?.tags ?? [])
  const [tagInput,      setTagInput]      = useState("")
  const [status,        setStatus]        = useState<BlogStatus>(initial?.status ?? "draft")
  const [saving,        setSaving]        = useState(false)
  const [previewing,    setPreviewing]    = useState(false)

  const isEditing = !!initial?.id

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-")
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t])
    }
    setTagInput("")
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  async function handleSave(publishStatus: BlogStatus) {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" })
      return
    }
    if (!content.trim() || content === "<br>") {
      toast({ title: "Content cannot be empty", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
      slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        title:         title.trim(),
        excerpt:       excerpt.trim(),
        content,
        coverImage: coverImage.trim(),
        category,
        tags,
        status:        publishStatus,
        authorId,
        authorName,
        authorRole,
        publishedAt: publishStatus === "published" ? new Date().toISOString() : null,
      }

      if (isEditing && initial?.id) {
        await BlogService.updatePost(initial.id, payload)
        toast({ title: publishStatus === "published" ? "Post updated & published ✅" : "Draft saved ✅" })
      } else {
        const { id } = await BlogService.createPost(payload)
        toast({ title: publishStatus === "published" ? "Post published ✅" : "Draft saved ✅" })
        router.replace(`${backHref.replace("/blog", "/blog")}/${id}/edit`)
        return
      }
      setStatus(publishStatus)
    } catch {
      toast({ title: "Failed to save post", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen">
      {/* Main content area */}
      <div className="flex-1 space-y-5">
        {/* Back + title bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(backHref)}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold text-white">
            {isEditing ? "Edit Post" : "New Post"}
          </h1>
          {status === "published" && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">
              PUBLISHED
            </span>
          )}
          {status === "draft" && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 font-bold px-2 py-0.5 rounded-full">
              DRAFT
            </span>
          )}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs">Post Title *</Label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter a compelling title…"
            className="bg-secondary border-white/10 text-white placeholder:text-white/30 text-lg font-semibold rounded-xl h-12"
          />
        </div>

        {/* Excerpt */}
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs">Excerpt / Summary</Label>
          <textarea
            value={excerpt}
            onChange={e => setExcerpt(e.target.value)}
            placeholder="A short summary shown on the blog list and SEO description…"
            rows={2}
            className="w-full px-3 py-2.5 bg-secondary border border-white/10 text-white text-sm placeholder:text-white/30 rounded-xl outline-none focus:border-primary/50 resize-none transition-colors"
          />
        </div>

        {/* Editor */}
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs">Content *</Label>
          <BlogEditor value={content} onChange={setContent} minHeight={500} />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-72 space-y-5 lg:pt-14">

        {/* Publish actions */}
        <div className="rounded-xl border border-white/10 bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white font-semibold text-sm">Publish</p>
          </div>
          <div className="p-4 space-y-3">
            <Button
              onClick={() => handleSave("published")}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-xl"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {status === "published" ? "Update Published Post" : "Publish Now"}
            </Button>
            <Button
              onClick={() => handleSave("draft")}
              disabled={saving}
              variant="outline"
              className="w-full border-white/10 text-white hover:bg-white/5 rounded-xl"
            >
              Save as Draft
            </Button>
            {isEditing && initial?.slug && (
              <a
                href={`/blog/${initial.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 text-white/40 hover:text-white text-xs transition-colors"
              >
                <Eye className="h-3.5 w-3.5" /> Preview post
              </a>
            )}
          </div>
        </div>

        {/* Cover Image URL */}
        <div className="rounded-xl border border-white/10 bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white font-semibold text-sm">Cover Image</p>
            <p className="text-white/30 text-xs mt-0.5">Paste an external image URL</p>
          </div>
          <div className="p-4 space-y-3">
            <Input
              value={coverImage}
              onChange={e => setCoverImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/…"
              className="bg-white/5 border-white/10 text-white text-xs placeholder:text-white/30 rounded-lg"
            />
            {coverImage && (
              <div className="rounded-lg overflow-hidden h-32 bg-white/5">
                <img
                  src={coverImage}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3" }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Category */}
        <div className="rounded-xl border border-white/10 bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white font-semibold text-sm">Category</p>
          </div>
          <div className="p-4">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2 outline-none"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c} className="bg-[#1a1a2e]">{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="rounded-xl border border-white/10 bg-secondary overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white font-semibold text-sm">Tags</p>
            <p className="text-white/30 text-xs mt-0.5">Up to 10 tags</p>
          </div>
          <div className="p-4 space-y-3">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full"
                  >
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-white">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                placeholder="Add tag…"
                className="bg-white/5 border-white/10 text-white text-xs placeholder:text-white/30 rounded-lg h-8 flex-1"
              />
              <Button
                onClick={addTag}
                size="sm"
                variant="outline"
                className="h-8 text-xs border-white/10 text-white hover:bg-white/5"
              >
                Add
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
