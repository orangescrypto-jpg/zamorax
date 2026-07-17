// app/api/admin/offers/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

// Any offer still "pending" or "accepted" whose 24h window (expires_at) has
// passed and was never spent on an order gets flipped to "expired" here.
// This runs on every GET so the admin list always reflects the current
// state without needing a separate cron trigger, and it's cheap — a single
// UPDATE against an indexed column.
async function sweepExpired(nativeDB?: unknown) {
  const nowIso = new Date().toISOString()
  await d1Query(
    `UPDATE offers
       SET status = 'expired'
     WHERE status IN ('pending', 'accepted')
       AND expires_at IS NOT NULL
       AND expires_at != ''
       AND expires_at < ?`,
    [nowIso],
    nativeDB,
  )
}

// ── GET — admin: list offers, with expired ones swept first ──────────────────
export async function GET(req: NextRequest, context: RouteContext) {
  const { ok, error } = await requireAdmin(req)
  if (!ok) return error!

  const nativeDB = (context as any)?.env?.DB

  try {
    await sweepExpired(nativeDB)

    const statusFilter = req.nextUrl.searchParams.get("status") // optional: "expired" | "pending" | ...
    const sql = statusFilter
      ? `SELECT * FROM offers WHERE status = ? ORDER BY created_at DESC LIMIT 500`
      : `SELECT * FROM offers ORDER BY created_at DESC LIMIT 500`
    const result = await d1Query(sql, statusFilter ? [statusFilter] : [], nativeDB)

    const countRow = await d1Query(
      `SELECT COUNT(*) as c FROM offers WHERE status = 'expired'`,
      [],
      nativeDB,
    )
    const expiredCount = Number((countRow as any)?.results?.[0]?.c ?? 0)

    return NextResponse.json({
      offers: (result as any)?.results ?? [],
      expiredCount,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE — admin: permanently remove every expired offer ───────────────────
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { ok, error } = await requireAdmin(req)
  if (!ok) return error!

  const nativeDB = (context as any)?.env?.DB

  try {
    await sweepExpired(nativeDB)

    const body = await req.json().catch(() => ({}))
    const singleId = typeof body?.offerId === "string" ? body.offerId : null

    if (singleId) {
      // Delete a single expired offer by id (used by the per-row delete button).
      await d1Query(
        `DELETE FROM offers WHERE id = ? AND status = 'expired'`,
        [singleId],
        nativeDB,
      )
      return NextResponse.json({ success: true, deletedCount: 1 })
    }

    // Bulk delete: every offer currently marked expired.
    const countRow = await d1Query(
      `SELECT COUNT(*) as c FROM offers WHERE status = 'expired'`,
      [],
      nativeDB,
    )
    const deletedCount = Number((countRow as any)?.results?.[0]?.c ?? 0)

    await d1Query(`DELETE FROM offers WHERE status = 'expired'`, [], nativeDB)

    return NextResponse.json({ success: true, deletedCount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
