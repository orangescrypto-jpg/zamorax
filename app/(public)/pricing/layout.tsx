// app/(public)/pricing/layout.tsx
import type { Metadata } from "next"

// Metadata for a client-component page (client pages cannot export metadata themselves).
export const metadata: Metadata = {
  title: "Seller Plans & Pricing",
  description: "Grow your sales on Zamorax. Compare seller plans, listing limits and fees for Nigerian sellers.",
  alternates: { canonical: "https://zamorax.com/pricing" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
