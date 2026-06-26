// app/api/admin/overview/route.ts
// Server-side endpoint for admin overview stats.
// Replaces the broken client-side d1Query calls in AdminOverviewPage.

import { NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

export const runtime = "edge"

export async function GET() {
  try {
    const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

    const [
      users,
      listings,
      disputes,
      orders,
      withdrawals,
      payouts,
      reports,
      searchAlerts,
      bundles,
      recentUsers,
      recentDisputes,
      recentPayouts,
    ] = await Promise.all([
      // Users
      d1Query(`SELECT role, isBanned, createdAt FROM users`),
      // Listings
      d1Query(`SELECT status FROM listings`),
      // Disputes
      d1Query(`SELECT status, autoResolved, autoResolvedAt FROM disputes`),
      // Orders GMV
      d1Query(`SELECT totalAmount, commissionAmount FROM orders`),
      // Pending withdrawals
      d1Query(`SELECT amount FROM withdrawals WHERE status = 'pending'`),
      // Pending payout requests
      d1Query(`SELECT amountKobo FROM payoutRequests WHERE status = 'pending'`),
      // Pending listing reports
      d1Query(`SELECT id FROM listingReports WHERE status = 'pending'`),
      // Active search alerts
      d1Query(`SELECT id FROM searchAlerts`),
      // Active bundles
      d1Query(`SELECT id FROM bundles WHERE status = 'active'`),
      // Recent users (for activity feed)
      d1Query(`SELECT id, fullName, email, role, createdAt FROM users ORDER BY createdAt DESC LIMIT 4`),
      // Recent disputes (for activity feed)
      d1Query(`SELECT id, reason, orderId, status, createdAt FROM disputes ORDER BY createdAt DESC LIMIT 4`),
      // Recent payout requests (for activity feed)
      d1Query(`SELECT id, bankName, amountKobo, status, createdAt FROM payoutRequests ORDER BY createdAt DESC LIMIT 3`),
    ])

    const userRows       = users?.results       ?? []
    const listingRows    = listings?.results     ?? []
    const disputeRows    = disputes?.results     ?? []
    const orderRows      = orders?.results       ?? []
    const withdrawalRows = withdrawals?.results  ?? []
    const payoutRows     = payouts?.results      ?? []
    const reportRows     = reports?.results      ?? []
    const alertRows      = searchAlerts?.results ?? []
    const bundleRows     = bundles?.results      ?? []

    // Compute stats
    const totalUsers      = userRows.length
    const totalSellers    = userRows.filter((u: any) => u.role === "seller" || u.role === "both").length
    const bannedUsers     = userRows.filter((u: any) => u.isBanned).length
    const newUsersToday   = userRows.filter((u: any) => u.createdAt && u.createdAt >= todayISO).length

    const pendingListings = listingRows.filter((l: any) => l.status === "pending").length
    const activeListings  = listingRows.filter((l: any) => l.status === "active").length

    const openDisputes          = disputeRows.filter((d: any) => d.status === "open").length
    const investigatingDisputes = disputeRows.filter((d: any) => d.status === "investigating").length
    const autoResolvedToday     = disputeRows.filter((d: any) => d.autoResolved && d.autoResolvedAt && d.autoResolvedAt >= todayISO).length

    let totalGMV = 0, totalCommission = 0
    orderRows.forEach((o: any) => {
      totalGMV        += Number(o.totalAmount)       || 0
      totalCommission += Number(o.commissionAmount)  || 0
    })

    let pendingWithdrawalAmount = 0
    withdrawalRows.forEach((w: any) => { pendingWithdrawalAmount += Number(w.amount) || 0 })

    let pendingPayoutAmount = 0
    payoutRows.forEach((p: any) => { pendingPayoutAmount += Number(p.amountKobo) || 0 })

    const stats = {
      totalUsers, newUsersToday, totalSellers, bannedUsers,
      pendingListings, activeListings,
      openDisputes, investigatingDisputes, autoResolvedToday,
      totalGMV, totalCommission,
      pendingWithdrawals: withdrawalRows.length,
      pendingWithdrawalAmount,
      pendingPayouts: payoutRows.length,
      pendingPayoutAmount,
      pendingReports: reportRows.length,
      activeSearchAlerts: alertRows.length,
      activeBundles: bundleRows.length,
    }

    // Build activity feed
    const activity = [
      ...(recentUsers?.results ?? []).map((d: any) => ({
        id: d.id, type: "user",
        label: `New user: ${d.fullName || "Unknown"}`,
        sub: d.email || "",
        time: d.createdAt,
        badge: d.role,
      })),
      ...(recentDisputes?.results ?? []).map((d: any) => ({
        id: d.id, type: "dispute",
        label: `Dispute: ${d.reason || "No reason"}`,
        sub: `Order #${String(d.orderId || "").slice(-6).toUpperCase() || "—"}`,
        time: d.createdAt,
        badge: d.status,
      })),
      ...(recentPayouts?.results ?? []).map((d: any) => ({
        id: d.id, type: "payout",
        label: `Payout request: ${d.bankName}`,
        sub: String(Number(d.amountKobo) || 0),
        time: d.createdAt,
        badge: d.status,
      })),
    ]
      .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""))
      .slice(0, 12)

    return NextResponse.json({ stats, activity })
  } catch (err: any) {
    console.error("[admin/overview]", err)
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 })
  }
}
