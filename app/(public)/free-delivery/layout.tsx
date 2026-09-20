// app/(public)/free-delivery/layout.tsx
import type { Metadata } from "next"

// Metadata for a client-component page (client pages cannot export metadata themselves).
export const metadata: Metadata = {
  title: "Free Delivery Listings",
  description: "Shop listings with no delivery fee. Verified sellers, escrow-protected payments and nationwide delivery across Nigeria.",
  alternates: { canonical: "https://zamorax.com/free-delivery" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
