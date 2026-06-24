// app/(public)/browse/page.tsx
// /browse redirects straight to /search.
// Exists only to prevent 404 from any old "Browse all" links.

import { redirect } from "next/navigation"

export default function BrowsePage() {
  redirect("/search")
}
