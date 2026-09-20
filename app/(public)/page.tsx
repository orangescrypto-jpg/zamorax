// app/(public)/page.tsx
// app/(public)/page.tsx — SERVER component.
// Owns SEO (metadata + JSON-LD) and server-rendered product links; the
// interactive UI lives in components/home/HomeClient.tsx.
import type { Metadata } from "next"
import HomeClient from "@/components/home/HomeClient"
import { LatestListingsServer } from "@/components/home/LatestListingsServer"

export const revalidate = 300 // refresh the server-rendered section every 5 min

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"
const TITLE = "Zamorax — Buy, Sell & Rent Across Nigeria"
const DESC =
  "Nigeria's safest marketplace. Buy, sell and rent phones, laptops, fashion, cars & more. Verified sellers, escrow-protected payments, and nationwide delivery."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: BASE },
  openGraph: { type: "website", url: BASE, title: TITLE, description: DESC, siteName: "Zamorax", locale: "en_NG" },
}

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zamorax",
    url: BASE,
    logo: `${BASE}/icon-512.png`,
    sameAs: ["https://x.com/zamoraxng"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Zamorax",
    url: BASE,
    inLanguage: "en-NG",
  },
]

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeClient latestListings={<LatestListingsServer />} />
    </>
  )
}
