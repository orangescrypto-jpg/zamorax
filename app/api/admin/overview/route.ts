// app/api/admin/overview/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

// Returns the first row of a query, or a fallback object if it fails.
async function safeRow<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  nativeDB?: unknown,
  fallback: T = {} as T,
): Promise<T> {
  try {
    const result = await d1Query(sql, params, nativeDB)
    const rows = (result?.results ?? result ?? []) as T[]
    return rows[0] ?? fallback
  } catch {
    return fallback
  }
}

// Returns all rows of a query, or [] if it fails.
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

    // All stats via aggregate SQL — no full-table fetches.
    const [
      userStats,
      listingStats,
      disputeStats,
      orderStats,
      withdrawalStats,
      payoutStats,
      reportCount,
      searchAlertCount,
      bundleCount,
      pendingPaymentCount,
      officialStats,
      recentUsers,
      recentDisputes,
      recentPayouts,
    ] = await Promise.all([
      // Users: total, sellers, banned, new today — one query
      safeRow<any>(`
        SELECT
          COUNT(*)                                                         AS total_users,
          SUM(CASE WHEN role IN ('seller','both') THEN 1 ELSE 0 END)      AS total_sellers,
          SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END)                  AS banned_users,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END)                AS new_today
        FROM users
      `, [todayISO], nativeDB, { total_users: 0, total_sellers: 0, banned_users: 0, new_today: 0 }),

      // Listings: pending + active counts
      safeRow<any>(`
        SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_listings,
          SUM(CASE WHEN status = 'active'  THEN 1 ELSE 0 END) AS active_listings
        FROM listings
      `, [], nativeDB, { pending_listings: 0, active_listings: 0 }),

      // Disputes: open + investigating counts
      safeRow<any>(`
        SELECT
          SUM(CASE WHEN status = 'open'          THEN 1 ELSE 0 END) AS open_disputes,
          SUM(CASE WHEN status = 'investigating' THEN 1 ELSE 0 END) AS investigating_disputes
        FROM disputes
      `, [], nativeDB, { open_disputes: 0, investigating_disputes: 0 }),

      // Orders: total GMV + commission
      safeRow<any>(`
        SELECT
          COALESCE(SUM(total_amount), 0)  AS total_gmv,
          COALESCE(SUM(platform_fee), 0)  AS total_commission
        FROM orders
      `, [], nativeDB, { total_gmv: 0, total_commission: 0 }),

      // Pending withdrawals: count + total amount
      safeRow<any>(`
        SELECT
          COUNT(*)                        AS pending_count,
          COALESCE(SUM(amount), 0)        AS pending_amount
        FROM withdrawals WHERE status = 'pending'
      `, [], nativeDB, { pending_count: 0, pending_amount: 0 }),

      // Pending payout requests: count + total amount
      safeRow<any>(`
        SELECT
          COUNT(*)                        AS pending_count,
          COALESCE(SUM(amount), 0)        AS pending_amount
        FROM payout_requests WHERE status = 'pending'
      `, [], nativeDB, { pending_count: 0, pending_amount: 0 }),

      // Pending listing reports
      safeRow<any>(
        `SELECT COUNT(*) AS cnt FROM listing_reports WHERE status = 'pending'`,
        [], nativeDB, { cnt: 0 },
      ),

      // Active search alerts
      safeRow<any>(
        `SELECT COUNT(*) AS cnt FROM search_alerts`,
        [], nativeDB, { cnt: 0 },
      ),

      // Active bundles
      safeRow<any>(
        `SELECT COUNT(*) AS cnt FROM bundles WHERE status = 'active'`,
        [], nativeDB, { cnt: 0 },
      ),

      // Unconfirmed pending payments
      safeRow<any>(
        `SELECT COUNT(*) AS cnt FROM pending_payments WHERE admin_confirmed = 0 OR admin_confirmed IS NULL`,
        [], nativeDB, { cnt: 0 },
      ),

      // Official (Zamorax Enterprises Direct) listings — count + sellers +
      // GMV from orders placed on those listings specifically. Mirrors the
      // same official-listing definition used in /api/listings: seller
      // flagged is_official, OR the individual listing was picked.
      safeRow<any>(`
        SELECT
          COUNT(DISTINCT l.id)                                              AS official_listing_count,
          COUNT(DISTINCT l.seller_id)                                       AS official_seller_count,
          COALESCE((
            SELECT SUM(o.total_amount) FROM orders o
            JOIN listings ol ON ol.id = o.listing_id
            JOIN users ou ON ou.uid = ol.seller_id
            WHERE ou.is_official = 1 OR ol.is_zamorax_pick = 1
          ), 0)                                                             AS official_gmv
        FROM listings l
        JOIN users u ON u.uid = l.seller_id
        WHERE l.status = 'active' AND (u.is_official = 1 OR l.is_zamorax_pick = 1)
      `, [], nativeDB, { official_listing_count: 0, official_seller_count: 0, official_gmv: 0 }),

      // Recent activity feeds (small fixed-size queries — these are fine)
      safeQuery<any>(
        `SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 4`,
        [], nativeDB,
      ),
      safeQuery<any>(
        `SELECT id, reason, order_id, status, created_at FROM disputes ORDER BY created_at DESC LIMIT 4`,
        [], nativeDB,
      ),
      safeQuery<any>(
        `SELECT id, bank_details, amount, status, created_at FROM payout_requests ORDER BY created_at DESC LIMIT 3`,
        [], nativeDB,
      ),
    ])

    const stats = {
      totalUsers:             Number(userStats.total_users)         || 0,
      newUsersToday:          Number(userStats.new_today)           || 0,
      totalSellers:           Number(userStats.total_sellers)       || 0,
      bannedUsers:            Number(userStats.banned_users)        || 0,
      pendingListings:        Number(listingStats.pending_listings) || 0,
      activeListings:         Number(listingStats.active_listings)  || 0,
      openDisputes:           Number(disputeStats.open_disputes)         || 0,
      investigatingDisputes:  Number(disputeStats.investigating_disputes) || 0,
      autoResolvedToday:      0,
      totalGMV:               Number(orderStats.total_gmv)          || 0,
      totalCommission:        Number(orderStats.total_commission)   || 0,
      pendingWithdrawals:     Number(withdrawalStats.pending_count) || 0,
      pendingWithdrawalAmount:Number(withdrawalStats.pending_amount)|| 0,
      pendingPayouts:         Number(payoutStats.pending_count)     || 0,
      pendingPayoutAmount:    Number(payoutStats.pending_amount)    || 0,
      pendingReports:         Number(reportCount.cnt)               || 0,
      pendingPayments:        Number(pendingPaymentCount.cnt)       || 0,
      activeSearchAlerts:     Number(searchAlertCount.cnt)          || 0,
      activeBundles:          Number(bundleCount.cnt)               || 0,
      officialListingCount:   Number(officialStats.official_listing_count) || 0,
      officialSellerCount:    Number(officialStats.official_seller_count)  || 0,
      officialGMV:            Number(officialStats.official_gmv)          || 0,
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
          sub: `₦${(Number(d.amount) || 0).toLocaleString("en-NG")}`,
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
