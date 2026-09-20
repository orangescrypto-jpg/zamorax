// app/api/blog/[id]/views/route.ts
// Public endpoint: increments a published post's view counter.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<{ id: string }>; env?: { DB?: unknown } }

export async function POST(_req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const { id } = await context.params
  if (!id || id.length > 100) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  try {
    // Atomic increment in SQL (no read-modify-write race). Deliberately does NOT touch
    // updated_at — that column feeds sitemap <lastmod> and Article dateModified, and
    // must only change when the post's content changes, not on every page view.
    await d1Query(
      "UPDATE blog SET views = COALESCE(views, 0) + 1 WHERE id = ? AND status = 'published'",
      [id],
      nativeDB,
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/blog/:id/views]", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
