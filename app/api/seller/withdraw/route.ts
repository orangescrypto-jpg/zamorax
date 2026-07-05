// app/api/seller/withdrawals/route.ts
// Lets a seller fetch their OWN withdrawal history for the wallet page's
// "Payout History" tab. The `withdrawals` table is intentionally
// ADMIN_ONLY in the D1 proxy (app/api/d1/query/route.ts) — sellers should
// never be able to read every other seller's bank details and payout
// amounts via a direct AdminService.getCollection("withdrawals") call.
// That's exactly what the seller wallet page was doing, so the proxy
// correctly blocked it, getCollection silently swallowed the error and
// returned [], and "Payout History" showed "No payouts yet" for every
// seller regardless of how many real withdrawals they had.
//
// This route runs server-side with the seller's own verified uid, filters
// to just their rows, and returns them — the seller gets to see their own
// history (including transfer reference and proof link once admin marks
// it paid) without the admin-only table being opened up to every seller.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireAuth(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const rows = await d1Query(
      `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [auth.uid],
      nativeDB,
    )
    return NextResponse.json({ withdrawals: rows?.results ?? [] })
  } catch (err: any) {
    console.error("[GET /api/seller/withdrawals]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
