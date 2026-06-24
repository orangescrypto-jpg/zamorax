// src/hooks/usePageContent.ts
// Reads page content from Firestore: page_content/{slug}
// Falls back to hardcoded default if no override exists.
// Used by every public content page so admin can edit without code changes.

"use client"

import { useEffect, useState } from "react"
import { AdminService } from "@/src/services"

export interface PageContent {
  slug: string
  html: string            // raw HTML or markdown-safe HTML stored by admin
  updatedAt?: number
}

/**
 * @param slug   e.g. "about", "terms", "privacy"
 * @param defaultHtml  The hardcoded fallback content (what's in the file today)
 */
export function usePageContent(slug: string, defaultHtml: string): {
  html: string
  loading: boolean
} {
  const [html, setHtml] = useState(defaultHtml)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AdminService.getDoc("page_content", slug)
      .then(doc => {
        if (doc?.html && typeof doc.html === "string") {
          setHtml(doc.html)
        }
      })
      .catch(() => { /* silently use default */ })
      .finally(() => setLoading(false))
  }, [slug])

  return { html, loading }
}
