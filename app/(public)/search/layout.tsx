// app/(public)/search/layout.tsx
import type { Metadata } from "next"

// Metadata for a client-component page (client pages cannot export metadata themselves).
export const metadata: Metadata = {
  title: "Search Listings — Find Anything in Nigeria",
  description: "Search and filter thousands of listings by category, location, condition and price from verified sellers across Nigeria.",
  alternates: { canonical: "https://zamorax.com/search" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
