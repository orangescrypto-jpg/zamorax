// app/(public)/flash-deals/layout.tsx
import type { Metadata } from "next"

// Metadata for a client-component page (client pages cannot export metadata themselves).
export const metadata: Metadata = {
  title: "Flash Deals — Limited-Time Discounts",
  description: "Limited-time discounts on phones, laptops, fashion and more from verified Nigerian sellers. Grab flash deals before they expire.",
  alternates: { canonical: "https://zamorax.com/flash-deals" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
