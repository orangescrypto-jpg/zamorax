// app/api/admin/manage-listings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function rowToListing(row: Record<string, unknown>) {
  let images: string[] = []
  try { images = JSON.parse(row.images as string ?? "[]") } catch { images = [] }
  return {
    id:           row.id,
    sellerId:     row.seller_id,
    sellerName:   row.seller_name,
    title:        row.title,
    description:  row.description,
    priceSale:    Number(row.price) || 0,
    categorySlug: row.category,
    condition:    row.condition,
    images,
    status:       row.status,
    isBoosted:    !!row.is_boosted,
    city:         row.seller_state,
    views:        Number(row.views) || 0,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB
  const { searchParams } = new URL(req.url)

  const status = searchParams.get("status") ?? "all"  // all | pending | active | rejected
  const search = searchParams.get("search")?.trim() ?? ""
  const page   = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10))
  const limit  = 20

  const wheres: string[] = []
  const vals:   unknown[] = []

  if (status !== "all") { wheres.push("status = ?"); vals.push(status) }
  if (search) {
    wheres.push("(title LIKE ? OR seller_name LIKE ?)")
    vals.push(`%${search}%`, `%${search}%`)
  }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : ""

  try {
    const [countRows, rows] = await Promise.all([
      d1Query<{ total: number }>(`SELECT COUNT(*) as total FROM listings ${where}`, vals, nativeDB),
      d1Query(
        `SELECT * FROM listings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...vals, limit, page * limit], nativeDB,
      ),
    ])

    const total    = Number((countRows as any)?.[0]?.total ?? 0)
    const listings = ((rows as any[]) ?? []).map(r => rowToListing(r as any))

    return NextResponse.json({ listings, total, page, limit, hasMore: (page + 1) * limit < total })
  } catch (err: any) {
    console.error("[admin/manage-listings]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/manage-listings?id=xxx
export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  try {
    await d1Query("DELETE FROM listings WHERE id = ?", [id], nativeDB)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin/manage-listings — approve, reject, boost
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { id, action, reason } = await req.json()
    if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 })

    const now = new Date().toISOString()

    if (action === "approve") {
      await d1Query(
        "UPDATE listings SET status = 'active', updated_at = ? WHERE id = ?",
        [now, id], nativeDB,
      )
    } else if (action === "reject") {
      await d1Query(
        "UPDATE listings SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?",
        [reason ?? "", now, id], nativeDB,
      )
    } else if (action === "boost") {
      const boostExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await d1Query(
        "UPDATE listings SET is_boosted = 1, boost_expires_at = ?, updated_at = ? WHERE id = ?",
        [boostExpires, now, id], nativeDB,
      )
    } else if (action === "unboost") {
      await d1Query(
        "UPDATE listings SET is_boosted = 0, boost_expires_at = NULL, updated_at = ? WHERE id = ?",
        [now, id], nativeDB,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
