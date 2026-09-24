// app/api/buyback/pricing/route.ts
// Public read-only endpoint powering the Sell for Cash form's cascading
// selectors. No auth required - the form works for guests. Admin manages
// the underlying rows from /admin/buyback/pricing.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { loadBuybackSettings } from "@/lib/buyback/loadSettings"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const brand    = searchParams.get("brand")
  const model    = searchParams.get("model")
  const storage  = searchParams.get("storage")
  const condition = searchParams.get("condition")
  const nativeDB = (req as any)?.env?.DB

  try {
    // Distinct categories that have at least one active pricing row.
    if (!category) {
      const rows = await d1Query(
        "SELECT DISTINCT category_slug FROM buyback_pricing WHERE is_active = 1 ORDER BY category_slug",
        [],
        nativeDB,
      )
      const content = await loadBuybackSettings(nativeDB)
      return NextResponse.json({
        categories: (rows?.results ?? [])
          .map((r: any) => r.category_slug as string)
          .filter((slug: string) => !content.disabledCategories.includes(slug)),
      })
    }

    if (!brand) {
      const rows = await d1Query(
        "SELECT DISTINCT brand FROM buyback_pricing WHERE is_active = 1 AND category_slug = ? ORDER BY brand",
        [category],
        nativeDB,
      )
      return NextResponse.json({ brands: (rows?.results ?? []).map((r: any) => r.brand) })
    }

    if (!model) {
      const rows = await d1Query(
        "SELECT DISTINCT model FROM buyback_pricing WHERE is_active = 1 AND category_slug = ? AND brand = ? ORDER BY model",
        [category, brand],
        nativeDB,
      )
      return NextResponse.json({ models: (rows?.results ?? []).map((r: any) => r.model) })
    }

    if (!storage && !condition) {
      const rows = await d1Query(
        "SELECT DISTINCT storage_variant FROM buyback_pricing WHERE is_active = 1 AND category_slug = ? AND brand = ? AND model = ? ORDER BY storage_variant",
        [category, brand, model],
        nativeDB,
      )
      return NextResponse.json({
        storageVariants: (rows?.results ?? []).map((r: any) => r.storage_variant),
      })
    }

    // Final lookup: exact price for the full combination.
    const rows = await d1Query(
      `SELECT price, condition FROM buyback_pricing
        WHERE is_active = 1 AND category_slug = ? AND brand = ? AND model = ?
          AND (storage_variant = ? OR (storage_variant IS NULL AND ? = ''))
        ORDER BY price DESC`,
      [category, brand, model, storage ?? "", storage ?? ""],
      nativeDB,
    )
    const options = (rows?.results ?? []) as Array<{ price: number; condition: string }>

    if (condition) {
      const match = options.find(o => o.condition === condition)
      return NextResponse.json({ price: match?.price ?? null })
    }

    return NextResponse.json({ conditions: options })
  } catch (err) {
    console.error("[api/buyback/pricing] failed:", err)
    return NextResponse.json({ error: "Failed to load pricing" }, { status: 500 })
  }
}
