// app/api/admin/buyback/[id]/verify/route.ts
// Staff tick (or untick) "ownership verified at meet-up" after checking
// the seller's receipt or proof of purchase in person.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<{ id: string }>; env?: { DB?: unknown } }

export async function PATCH(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireModerator(req, nativeDB)
  if (!auth.ok) return auth.error

  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const verified = body?.verified === true

  try {
    const rows = await d1Query("SELECT id FROM buyback_requests WHERE id = ? LIMIT 1", [id], nativeDB)
    if (!rows?.results?.[0]) return NextResponse.json({ error: "Request not found." }, { status: 404 })

    if (verified) {
      await d1Query(
        `UPDATE buyback_requests
            SET ownership_verified = 1, ownership_verified_by = ?, ownership_verified_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?`,
        [auth.uid, id],
        nativeDB,
      )
    } else {
      await d1Query(
        `UPDATE buyback_requests
            SET ownership_verified = 0, ownership_verified_by = NULL, ownership_verified_at = NULL, updated_at = datetime('now')
          WHERE id = ?`,
        [id],
        nativeDB,
      )
    }

    return NextResponse.json({ ok: true, verified })
  } catch (err) {
    console.error("[admin/buyback verify PATCH] failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update verification." },
      { status: 500 },
    )
  }
}
