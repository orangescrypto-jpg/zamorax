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
  /** If true, renders nothing at all when there is no custom content
   *  (instead of falling back to defaultHtml). Use this to add an
   *  optional admin-editable block on top of an otherwise dynamic page,
   *  e.g. Contact or Pricing, without leaving empty whitespace when
   *  no admin content has been set yet. */
  hideIfEmpty?: boolean
}

export function PageContentRenderer({ slug, defaultHtml, skeleton, hideIfEmpty }: Props) {
  const { html, loading } = usePageContent(slug, defaultHtml)

  if (loading) {
    return skeleton ?? (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (hideIfEmpty && !html.trim()) return null

  return (
    <div
      className="prose prose-neutral max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
