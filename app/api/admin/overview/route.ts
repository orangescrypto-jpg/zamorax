// app/api/admin/overview/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function safeQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  nativeDB?: unknown,
): Promise<T[]> {
  try {
    const result = await d1Query(sql, params, nativeDB)
    return (result?.results ?? result ?? []) as T[]
  } catch {
    return []
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

    const [
      users, listings, disputes, orders, withdrawals, payouts,
      reports, searchAlerts, bundles, recentUsers, recentDisputes, recentPayouts,
    ] = await Promise.all([
      safeQuery(`SELECT role, is_banned, created_at FROM users`, [], nativeDB),
      safeQuery(`SELECT status FROM listings`, [], nativeDB),
      safeQuery(`SELECT status, created_at FROM disputes`, [], nativeDB),
      safeQuery(`SELECT total_amount, platform_fee, seller_payout FROM orders`, [], nativeDB),
      safeQuery(`SELECT amount FROM withdrawals WHERE status = 'pending'`, [], nativeDB),
      safeQuery(`SELECT amount FROM payout_requests WHERE status = 'pending'`, [], nativeDB),
      safeQuery(`SELECT id FROM listing_reports WHERE status = 'pending'`, [], nativeDB),
      safeQuery(`SELECT id FROM search_alerts`, [], nativeDB),
      safeQuery(`SELECT id FROM bundles WHERE status = 'active'`, [], nativeDB),
      safeQuery(`SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 4`, [], nativeDB),
      safeQuery(`SELECT id, reason, order_id, status, created_at FROM disputes ORDER BY created_at DESC LIMIT 4`, [], nativeDB),
      safeQuery(`SELECT id, bank_details, amount, status, created_at FROM payout_requests ORDER BY created_at DESC LIMIT 3`, [], nativeDB),
    ])

    const totalUsers      = users.length
    const totalSellers    = users.filter((u: any) => u.role === "seller" || u.role === "both").length
    const bannedUsers     = users.filter((u: any) => u.is_banned).length
    const newUsersToday   = users.filter((u: any) => u.created_at && u.created_at >= todayISO).length
    const pendingListings = listings.filter((l: any) => l.status === "pending").length
    const activeListings  = listings.filter((l: any) => l.status === "active").length
    const openDisputes          = disputes.filter((d: any) => d.status === "open").length
    const investigatingDisputes = disputes.filter((d: any) => d.status === "investigating").length

    let totalGMV = 0, totalCommission = 0
    orders.forEach((o: any) => {
      totalGMV        += Number(o.total_amount) || 0
      totalCommission += Number(o.platform_fee) || 0
    })

    let pendingWithdrawalAmount = 0
    withdrawals.forEach((w: any) => { pendingWithdrawalAmount += Number(w.amount) || 0 })

    let pendingPayoutAmount = 0
    payouts.forEach((p: any) => { pendingPayoutAmount += Number(p.amount) || 0 })

    const stats = {
      totalUsers, newUsersToday, totalSellers, bannedUsers,
      pendingListings, activeListings,
      openDisputes, investigatingDisputes, autoResolvedToday: 0,
      totalGMV, totalCommission,
      pendingWithdrawals: withdrawals.length, pendingWithdrawalAmount,
      pendingPayouts: payouts.length, pendingPayoutAmount,
      pendingReports: reports.length,
      activeSearchAlerts: searchAlerts.length,
      activeBundles: bundles.length,
    }

    const activity = [
      ...recentUsers.map((d: any) => ({
        id: d.id, type: "user",
        label: `New user: ${d.full_name || "Unknown"}`,
        sub: d.email || "",
        time: d.created_at,
        badge: d.role,
      })),
      ...recentDisputes.map((d: any) => ({
        id: d.id, type: "dispute",
        label: `Dispute: ${d.reason || "No reason"}`,
        sub: `Order #${String(d.order_id || "").slice(-6).toUpperCase() || "—"}`,
        time: d.created_at,
        badge: d.status,
      })),
      ...recentPayouts.map((d: any) => {
        let bankName = "—"
        try { bankName = JSON.parse(d.bank_details)?.bank_name ?? "—" } catch {}
        return {
          id: d.id, type: "payout",
          label: `Payout request: ${bankName}`,
          sub: `₦${((Number(d.amount) || 0)).toLocaleString("en-NG")}`,
          time: d.created_at,
          badge: d.status,
        }
      }),
    ].sort((a, b) => (b.time ?? "").localeCompare(a.time ?? "")).slice(0, 12)

    return NextResponse.json({ stats, activity })
  } catch (err: any) {
    console.error("[admin/overview]", err)
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 })
  }
}
