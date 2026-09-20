// app/(public)/zamorax-direct/page.tsx
// Landing route for official Zamorax Enterprises listings.
// Redirects into /search?official=true (reuses the existing filter/grid UI).
// Was a "use client" page that redirected in useEffect — Google saw a spinner and
// no redirect at all. A server redirect is a real HTTP 307 that crawlers understand.
import { redirect } from "next/navigation"

export default function ZamoraxDirectPage() {
  redirect("/search?official=true")
}
