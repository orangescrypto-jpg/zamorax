// app/api/disputes/by-user/route.ts
// Returns paginated disputes for the authenticated user (WHERE buyer_id = ?).
// Replaces the previous JavaScript full-table filter in getDisputesByUser().
// Guards:
//   - Caller must be authenticated
//   - userId param must match auth.uid (users can only read their own disputes)
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireAuth(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const url    = new URL(req.url)
    const userId = url.searchParams.get("userId") ?? ""
    const cursor = url.searchParams.get("cursor")    // ISO string of last created_at seen
    const rawSize = Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE)
    const pageSize = Math.min(Math.max(1, rawSize), MAX_PAGE_SIZE)

    // ── Guard: users can only read their own disputes ─────────────────────────
    if (userId !== auth.uid) {
      return NextResponse.json({ error: "Cannot read disputes for another user" }, { status: 403 })
    }

    // ── Paginated D1 query: WHERE buyer_id = ? ORDER BY created_at DESC ───────
    // Cursor-based: next page starts after the cursor's created_at value.
    let sql: string
    let params: unknown[]

    if (cursor) {
      sql    = `SELECT * FROM disputes WHERE buyer_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`
      params = [auth.uid, cursor, pageSize + 1]   // +1 to detect hasMore
    } else {
      sql    = `SELECT * FROM disputes WHERE buyer_id = ? ORDER BY created_at DESC LIMIT ?`
      params = [auth.uid, pageSize + 1]
    }

    const result = await d1Query(sql, params, nativeDB)
    const rows   = ((result as any)?.results ?? []) as Record<string, unknown>[]

    const hasMore    = rows.length > pageSize
    const page       = hasMore ? rows.slice(0, pageSize) : rows
    const nextCursor = hasMore ? String(page[page.length - 1]?.created_at ?? "") : null

    return NextResponse.json({ items: page, nextCursor, hasMore })
  } catch (err: any) {
    console.error("[disputes/by-user]", err)
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 })
  }
}
