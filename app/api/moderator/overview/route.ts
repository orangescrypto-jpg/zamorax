// app/api/moderator/overview/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function safeCount(sql: string, params: unknown[] = [], nativeDB?: unknown): Promise<number> {
  try {
    const result = await d1Query(sql, params, nativeDB)
    const rows = (result?.results ?? result ?? []) as Record<string, unknown>[]
    return Number(rows[0]?.count ?? rows.length) || 0
  } catch {
    return 0
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireModerator(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  const staleThresholdISO = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  const LOGISTICS_REASONS = [
    "parcel_not_received", "wrong_item_delivered",
    "item_damaged_in_transit", "parcel_lost", "delayed_delivery",
  ]
  const reasonPlaceholders = LOGISTICS_REASONS.map(() => "?").join(", ")

  const [
    pendingListings,
    openDisputes,
    pendingVerifications,
    pendingReports,
    autoResolvedToday,
    pendingQnA,
    logisticsDisputes,
    staleShipments,
    flaggedZLAs,
    pendingZLAApplications,
  ] = await Promise.all([
    safeCount(`SELECT COUNT(*) as count FROM listings WHERE status = 'pending'`, [], nativeDB),
    safeCount(`SELECT COUNT(*) as count FROM disputes WHERE status = 'open'`, [], nativeDB),
    safeCount(`SELECT COUNT(*) as count FROM verification_requests WHERE status = 'pending'`, [], nativeDB),
    safeCount(`SELECT COUNT(*) as count FROM listing_reports WHERE status = 'pending'`, [], nativeDB),
    safeCount(`SELECT COUNT(*) as count FROM disputes WHERE status = 'resolved' AND updated_at >= ?`, [todayISO], nativeDB),
    safeCount(`SELECT COUNT(*) as count FROM listing_qna WHERE answer IS NULL`, [], nativeDB),
    safeCount(
      `SELECT COUNT(*) as count FROM disputes WHERE status IN ('open','investigating') AND reason IN (${reasonPlaceholders})`,
      LOGISTICS_REASONS, nativeDB
    ),
    safeCount(
      `SELECT COUNT(*) as count FROM shipments WHERE status IN ('awaiting_dropoff','dropped_off','in_transit','at_destination_agent') AND updated_at < ?`,
      [staleThresholdISO], nativeDB
    ),
    safeCount(`SELECT COUNT(*) as count FROM agent_locations WHERE is_flagged = 1`, [], nativeDB),
    safeCount(`SELECT COUNT(*) as count FROM zla_applications WHERE status = 'pending'`, [], nativeDB),
  ])

  return NextResponse.json({
    pendingListings,
    openDisputes,
    pendingVerifications,
    pendingReports,
    autoResolvedToday,
    pendingQnA,
    logisticsDisputes,
    staleShipments,
    flaggedZLAs,
    pendingZLAApplications,
  })
}
