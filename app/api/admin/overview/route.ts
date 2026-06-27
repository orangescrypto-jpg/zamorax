// app/api/admin/overview/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  })
  const json = await res.json() as any
  if (!json.success) throw new Error(`D1 error: ${json.errors?.[0]?.message ?? "unknown"}`)
  return (json.result?.[0]?.results ?? []) as T[]
}

// Safe query — returns [] instead of throwing if the table doesn't exist yet
async function safeQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await d1Query<T>(sql, params)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  try {
    const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

    const [
      users, listings, disputes, orders, withdrawals, payouts,
      reports, searchAlerts, bundles, recentUsers, recentDisputes, recentPayouts,
    ] = await Promise.all([
      safeQuery(`SELECT role, is_banned, created_at FROM users`),
      safeQuery(`SELECT status FROM listings`),
      safeQuery(`SELECT status, created_at FROM disputes`),
      safeQuery(`SELECT total_amount, platform_fee, seller_payout FROM orders`),
      safeQuery(`SELECT amount FROM withdrawals WHERE status = 'pending'`),
      safeQuery(`SELECT amount FROM payout_requests WHERE status = 'pending'`),
      safeQuery(`SELECT id FROM listing_reports WHERE status = 'pending'`),
      safeQuery(`SELECT id FROM search_alerts`),
      safeQuery(`SELECT id FROM bundles WHERE status = 'active'`),
      safeQuery(`SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 4`),
      safeQuery(`SELECT id, reason, order_id, status, created_at FROM disputes ORDER BY created_at DESC LIMIT 4`),
      safeQuery(`SELECT id, bank_details, amount, status, created_at FROM payout_requests ORDER BY created_at DESC LIMIT 3`),
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
