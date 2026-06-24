import { getCategoryBySlug } from "@/constants/categories"
import { CategoryView } from "@/components/categories/CategoryView"
import type { Metadata } from "next"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) return { title: "Category Not Found | Zamorax" }
  return {
    title: `${category.name} in Nigeria | Buy, Sell & Rent — Zamorax`,
    description: `Browse verified ${category.name} listings. ${category.trustTip} Secure escrow payments & fast delivery across Nigeria.`,
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params

  const category = getCategoryBySlug(slug)

  if (!category) {
    return (
      <div className="container flex h-[50vh] items-center justify-center text-center">
        <div>
          <h1 className="text-2xl font-bold">Category Not Found</h1>
          <p className="text-muted-foreground mt-2">We couldn't find what you're looking for.</p>
        </div>
      </div>
    )
  }

  return <CategoryView category={category} />
}
