// app/(public)/categories/page.tsx
import Link from "next/link"
import type { Metadata } from "next"
import { ALL_CATEGORIES } from "@/constants/categories"

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"

export const metadata: Metadata = {
  title: "All Categories — Browse Everything on Zamorax",
  description:
    "Browse every category on Zamorax: phones, computing, fashion, vehicles, furniture, solar, farming and more. Verified sellers and escrow-protected payments across Nigeria.",
  alternates: { canonical: `${BASE}/categories` },
}

export default function CategoriesIndexPage() {
  const categories = ALL_CATEGORIES.filter(c => c.isActive)
  return (
    <main className="container py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Browse All Categories</h1>
        <p className="text-sm text-muted-foreground">
          Find verified listings from trusted Nigerian sellers, with escrow-protected payments.
        </p>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(c => (
          <li key={c.id}>
            <Link
              href={`/categories/${c.slug}`}
              className="block h-full rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <h2 className="font-semibold">{c.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.trustTip}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
