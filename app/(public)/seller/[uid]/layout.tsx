// app/(public)/seller/[uid]/layout.tsx
import type { Metadata } from "next"
import { d1Query } from "@/lib/d1"

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"

export async function generateMetadata(
  { params }: { params: Promise<{ uid: string }> },
): Promise<Metadata> {
  const { uid } = await params
  try {
    // Public storefront fields only (mirrors app/api/seller/[uid]/route.ts — no PII).
    const result = await d1Query(
      "SELECT store_name, full_name, store_description, profile_photo FROM users WHERE uid = ? LIMIT 1",
      [uid],
    )
    const row = (result as any)?.results?.[0]
    if (!row) return { title: "Seller not found", robots: { index: false, follow: false } }

    const name = row.store_name || row.full_name || "Seller"
    const description =
      (row.store_description as string | null)?.trim().slice(0, 155) ||
      `Shop ${name} on Zamorax. Verified seller with escrow-protected payments across Nigeria.`
    const url = `${BASE}/seller/${uid}`
    return {
      title: `${name} — Seller Store`,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "profile", url, title: `${name} on Zamorax`, description, siteName: "Zamorax", locale: "en_NG",
        ...(row.profile_photo ? { images: [{ url: row.profile_photo as string, alt: name }] } : {}),
      },
    }
  } catch {
    return { title: "Seller Store" }
  }
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
