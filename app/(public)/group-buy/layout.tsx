// app/(public)/group-buy/layout.tsx
import type { Metadata } from "next"

// Metadata for a client-component page (client pages cannot export metadata themselves).
export const metadata: Metadata = {
  title: "Group Buys — Buy Together, Pay Less",
  description: "Join a group buy on Zamorax and unlock lower prices when more buyers join. Escrow-protected payments across Nigeria.",
  alternates: { canonical: "https://zamorax.com/group-buy" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
