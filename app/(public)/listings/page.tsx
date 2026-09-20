// app/(public)/listings/page.tsx
import { permanentRedirect } from "next/navigation"

// There is no listings index — /search is the browse-everything page.
// 308 so any old links / link equity flow to the real page.
export default function ListingsIndexPage() {
  permanentRedirect("/search")
}
