// app/api/featured-banners/route.ts
// Public, unauthenticated read for the homepage "Featured Deals" cards
// (PromoStrip). Same fix as /api/site-banners — AdminService.subscribeTo-
// FeaturedBanners() went through the D1 proxy at /api/d1/query, which
// requires a logged-in session, so logged-out visitors never saw these
// either.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(_req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    const result = await d1Query(
      `SELECT id, tag, title, subtitle, href, image_url, color, icon, "order", active
       FROM featured_banners WHERE active = 1 ORDER BY "order" ASC`,
      [],
      nativeDB,
    )
    const rows = (result as any)?.results ?? []

    const banners = rows.map((r: any) => ({
      id:       r.id,
      tag:      r.tag,
      title:    r.title,
      subtitle: r.subtitle,
      href:     r.href,
      imageUrl: r.image_url,
      color:    r.color,
      icon:     r.icon,
      order:    r.order,
      active:   !!r.active,
    }))

    return NextResponse.json({ banners })
  } catch (err: any) {
    return NextResponse.json({ banners: [], error: err.message }, { status: 200 })
  }
}
