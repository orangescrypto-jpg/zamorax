"use client"

// app/(admin)/admin/content/page.tsx
// Content Management — admin can edit any public page's content without touching code.
// Content saved to Firestore: page_content/{slug}  { html: string, updatedAt: number }
// Public pages read this via usePageContent() hook with hardcoded fallback.

import { useEffect, useState, useRef } from "react"
import { AdminService } from "@/src/services"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Pencil, RotateCcw, Save, X, Eye } from "lucide-react"

// ─── Pages that can be managed ───────────────────────────────────────────────

const MANAGED_PAGES: { slug: string; label: string; path: string }[] = [
  { slug: "about",       label: "/About",        path: "/about" },
  { slug: "contact",     label: "/Contact",       path: "/contact" },
  { slug: "privacy",     label: "/Privacy",       path: "/privacy" },
  { slug: "terms",       label: "/Terms",         path: "/terms" },
  { slug: "cookies",     label: "/Cookies",       path: "/cookies" },
  { slug: "disclaimer",  label: "/Disclaimer",    path: "/disclaimer" },
  { slug: "safety",      label: "/Safety",        path: "/safety" },
  { slug: "how-it-works",label: "/How It Works",  path: "/how-it-works" },
  { slug: "pricing",     label: "/Pricing",       path: "/pricing" },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function ContentManagementPage() {
  const { toast } = useToast()
  const [contentMap, setContentMap] = useState<Record<string, string>>({})
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null)
  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [draftMap, setDraftMap] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load existing overrides from Firestore on mount
  useEffect(() => {
    const fetches = MANAGED_PAGES.map(({ slug }) =>
      AdminService.getDoc("page_content", slug)
        .then(doc => {
          if (doc?.html && typeof doc.html === "string") {
            setContentMap(prev => ({ ...prev, [slug]: doc.html as string }))
          }
        })
        .catch(() => {})
    )
    Promise.all(fetches)
  }, [])

  const statusLabel = (slug: string) =>
    contentMap[slug] ? "Custom content active" : "Using default system content"

  const handleEdit = (slug: string) => {
    setDraftMap(prev => ({ ...prev, [slug]: contentMap[slug] ?? "" }))
    setEditingSlug(slug)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleCancel = () => {
    setEditingSlug(null)
  }

  const handleSave = async (slug: string) => {
    const html = draftMap[slug] ?? ""
    setSavingSlug(slug)
    try {
      await AdminService.setDoc("page_content", slug, {
        slug,
        html,
        updatedAt: Date.now(),
      }, { merge: true })
      setContentMap(prev => ({ ...prev, [slug]: html }))
      setEditingSlug(null)
      toast({ title: "Saved", description: `/${slug} content updated. Changes are live instantly.`, variant: "success" })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast({ title: "Save failed", description: msg, variant: "destructive" })
    } finally {
      setSavingSlug(null)
    }
  }

  const handleReset = async (slug: string) => {
    if (!confirm(`Reset /${slug} to default system content? This cannot be undone.`)) return
    setLoadingSlug(slug)
    try {
      await AdminService.deleteDoc("page_content", slug)
      setContentMap(prev => {
        const next = { ...prev }
        delete next[slug]
        return next
      })
      setEditingSlug(null)
      toast({ title: "Reset", description: `/${slug} is now using default content.` })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast({ title: "Reset failed", description: msg, variant: "destructive" })
    } finally {
      setLoadingSlug(null)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading">Content Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Edit public page content without touching code. Changes are live instantly.
        </p>
      </div>

      {/* Page Cards */}
      <div className="space-y-4">
        {MANAGED_PAGES.map(({ slug, label, path }) => {
          const isEditing = editingSlug === slug
          const isSaving = savingSlug === slug
          const isLoading = loadingSlug === slug
          const hasCustom = !!contentMap[slug]

          return (
            <Card key={slug} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Row: title + status + actions */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base">{label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {hasCustom
                        ? <span className="text-emerald-600 font-medium">✓ Custom content active</span>
                        : statusLabel(slug)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {/* Preview */}
                    <a href={path} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                    </a>

                    {/* Reset to Default */}
                    {hasCustom && !isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={isLoading}
                        onClick={() => handleReset(slug)}
                      >
                        {isLoading
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RotateCcw className="h-3.5 w-3.5" />}
                        Reset to Default
                      </Button>
                    )}

                    {/* Edit / Cancel */}
                    {!isEditing ? (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"
                        onClick={() => handleEdit(slug)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit Content
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleCancel}
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Editor — shown when editing */}
                {isEditing && (
                  <div className="space-y-3 pt-1 border-t">
                    <p className="text-xs text-muted-foreground">
                      Paste HTML or plain text. This replaces the entire page body.
                      Leave blank and save to use default content.
                    </p>
                    <Textarea
                      ref={editingSlug === slug ? textareaRef : undefined}
                      value={draftMap[slug] ?? ""}
                      onChange={e =>
                        setDraftMap(prev => ({ ...prev, [slug]: e.target.value }))
                      }
                      placeholder={`Paste your HTML content for ${label} here…`}
                      className="min-h-[240px] font-mono text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 text-white"
                        disabled={isSaving}
                        onClick={() => handleSave(slug)}
                      >
                        {isSaving
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Save className="h-3.5 w-3.5" />}
                        {isSaving ? "Saving…" : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Info box */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">How it works</p>
        <p>Each page reads from Firestore first. If no custom content exists, the hardcoded default is shown. Custom content takes effect instantly — no rebuild needed.</p>
        <p>Tip: You can paste full HTML including headings, lists, and links. Images must be hosted externally (e.g. Firebase Storage URL).</p>
      </div>
    </div>
  )
}
