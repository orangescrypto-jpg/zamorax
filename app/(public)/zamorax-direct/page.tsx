"use client"
// app/(public)/zamorax-direct/page.tsx
// Dedicated landing page for official Zamorax Enterprises listings
// (bulk-sourced, locally warehoused stock — see migration 0002 / users.is_official).
//
// Deliberately thin: redirects straight into /search?official=true so it
// reuses the existing ListingFilter, ListingGrid, pagination, and empty
// states rather than duplicating that logic in a second page. The
// "Zamorax Direct only" checkbox in ListingFilter is the same param, so a
// buyer landing here sees it pre-checked and can drop it to browse everything.

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function ZamoraxDirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/search?official=true")
  }, [router])

  return (
    <div className="container py-20 flex justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
