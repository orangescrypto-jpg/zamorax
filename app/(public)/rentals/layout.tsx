// app/(public)/rentals/layout.tsx
import type { Metadata } from "next"

// Metadata for a client-component page (client pages cannot export metadata themselves).
export const metadata: Metadata = {
  title: "Rent Items in Nigeria — Daily & Weekly Rentals",
  description: "Rent equipment, electronics, vehicles and event gear from verified sellers across Nigeria. Daily and weekly rates with escrow-protected deposits.",
  alternates: { canonical: "https://zamorax.com/rentals" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
