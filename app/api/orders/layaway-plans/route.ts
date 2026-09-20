// app/api/orders/layaway-plans/route.ts
// Lists layaway plans for the logged in user -- as buyer or as seller,
// depending on the "role" query param. Used by the buyer/seller dashboard
// cards showing "Complete your layaway payment" or "Pending layaway sales".
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB
  const role = req.nextUrl.searchParams.get("role") === "seller" ? "seller" : "buyer"
  const column = role === "seller" ? "seller_id" : "buyer_id"

  try {
    const rows = await d1Query(
      `SELECT * FROM layaway_plans WHERE ${column} = ? ORDER BY created_at DESC LIMIT 100`,
      [auth.uid],
      nativeDB,
    )
    return NextResponse.json({ plans: rows?.results ?? [] })
  } catch (err: any) {
    console.error("[orders/layaway-plans]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
