"use client"

// components/PageContentRenderer.tsx
// Renders admin-managed page content from Firestore.
// Falls back to children (hardcoded default) if no override exists.

import { usePageContent } from "@/src/hooks/usePageContent"
import { Loader2 } from "lucide-react"

interface Props {
  slug: string
  defaultHtml: string
  /** Shown while Firestore fetch is in progress */
  skeleton?: React.ReactNode
}

export function PageContentRenderer({ slug, defaultHtml, skeleton }: Props) {
  const { html, loading } = usePageContent(slug, defaultHtml)

  if (loading) {
    return skeleton ?? (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div
      className="prose prose-neutral max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
