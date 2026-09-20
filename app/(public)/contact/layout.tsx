// app/(public)/contact/layout.tsx
import type { Metadata } from "next"

// Metadata for a client-component page (client pages cannot export metadata themselves).
export const metadata: Metadata = {
  title: "Contact Support",
  description: "Get help with orders, payments, escrow or your account. Contact the Zamorax support team.",
  alternates: { canonical: "https://zamorax.com/contact" },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
