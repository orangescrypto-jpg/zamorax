// app/(public)/categories/[slug]/page.tsx
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getCategoryBySlug } from "@/constants/categories"
import { CategoryView } from "@/components/categories/CategoryView"
import { getActiveListingsServer } from "@/lib/server/listings"
import { getSubSettings } from "@/src/services/subSettings"

// Rendered per request: CategoryView reads ?official= via useSearchParams, and we
// want the real listings in the HTML. (A statically prerendered page would push
// the whole grid behind a client-side Suspense boundary, defeating SSR.)
export const dynamic = "force-dynamic"

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) notFound() // decided before streaming starts, so it is a genuine HTTP 404

  const title = `${category.name} in Nigeria — Buy, Sell & Rent`
  const description = `Browse verified ${category.name} listings. ${category.trustTip} Secure escrow payments & fast delivery across Nigeria.`
  const url = `${BASE}/categories/${category.slug}`

  return {
    title, // root template appends " | Zamorax"
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title, description, siteName: "Zamorax", locale: "en_NG" },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) notFound() // real HTTP 404 (was a 200 "not found" box = soft 404)

  const subSettings = await getSubSettings()
  if (subSettings.disabledCategorySlugs.includes(slug)) notFound() // admin-disabled category

  const listings = await getActiveListingsServer({ category: category.slug, limit: 20 })
  const url = `${BASE}/categories/${category.slug}`

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} in Nigeria`,
    url,
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE },
        { "@type": "ListItem", position: 2, name: "Categories", item: `${BASE}/categories` },
        { "@type": "ListItem", position: 3, name: category.name, item: url },
      ],
    },
    ...(listings && listings.length > 0 && {
      mainEntity: {
        "@type": "ItemList",
        itemListElement: listings.map((l, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${BASE}/listings/${l.id}`,
          name: l.title,
        })),
      },
    }),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CategoryView category={category} initialListings={listings} />
    </>
  )
}
