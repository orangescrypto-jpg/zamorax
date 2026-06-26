// app/api/admin/overview/route.ts
// Server-side endpoint for admin overview stats.
// Auth pattern mirrors app/api/admin/settings/route.ts exactly.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ── D1 helper ────────────────────────────────────────────────────────────────
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

// ── Auth helpers (copied verbatim from /api/admin/settings/route.ts) ─────────
async function checkRoleByUid(uid: string, retries = 2): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const rows = await d1Query<{ role: string }>("SELECT role FROM users WHERE uid = ? LIMIT 1", [uid])
      return rows[0]?.role === "admin"
    } catch {
      if (attempt === retries) return false
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  return false
}

async function verifyJwt(token: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) return null

  const race = <T>(p: Promise<T>): Promise<T | null> =>
    Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), 9000))])

  if (serviceKey) {
    const uid = await race(
      createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
        .auth.getUser(token)
        .then(({ data: { user }, error }) => (!error && user?.id ? user.id : null))
        .catch(() => null)
    )
    if (uid) return uid
  }

  if (anonKey) {
    const uid = await race(
      createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
        .auth.getUser(token)
        .then(({ data: { user }, error }) => (!error && user?.id ? user.id : null))
        .catch(() => null)
    )
    if (uid) return uid
  }

  return null
}

async function isAdmin(req: NextRequest): Promise<{ ok: boolean }> {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const cookieToken = req.cookies.get("sb-access-token")?.value ?? null
  const cookieUid   = req.cookies.get("sb-uid")?.value ?? null
  const headerUid   = req.headers.get("x-user-id")

  const fastCheck      = cookieUid  ? checkRoleByUid(cookieUid)  : Promise.resolve(false)
  const uidHeaderCheck = headerUid  ? checkRoleByUid(headerUid)  : Promise.resolve(false)

  const jwtChecks: Promise<boolean>[] = []
  if (bearerToken) {
    jwtChecks.push(verifyJwt(bearerToken).then(uid => uid ? checkRoleByUid(uid) : false).catch(() => false))
  }
  if (cookieToken) {
    jwtChecks.push(verifyJwt(cookieToken).then(uid => uid ? checkRoleByUid(uid) : false).catch(() => false))
  }

  const results = await Promise.allSettled([fastCheck, uidHeaderCheck, ...jwtChecks])
  for (const r of results) {
    if (r.status === "fulfilled" && r.value === true) return { ok: true }
  }

  console.warn("[admin/overview] Unauthorized. cookies:", req.cookies.getAll().map(c => c.name), "hasBearer:", !!bearerToken)
  return { ok: false }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { ok } = await isAdmin(req)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
      d1Query(`SELECT role, isBanned, createdAt FROM users`),
      d1Query(`SELECT status FROM listings`),
      d1Query(`SELECT status, autoResolved, autoResolvedAt FROM disputes`),
      d1Query(`SELECT totalAmount, commissionAmount FROM orders`),
      d1Query(`SELECT amount FROM withdrawals WHERE status = 'pending'`),
      d1Query(`SELECT amountKobo FROM payoutRequests WHERE status = 'pending'`),
      d1Query(`SELECT id FROM listingReports WHERE status = 'pending'`),
      d1Query(`SELECT id FROM searchAlerts`),
      d1Query(`SELECT id FROM bundles WHERE status = 'active'`),
      d1Query(`SELECT id, fullName, email, role, createdAt FROM users ORDER BY createdAt DESC LIMIT 4`),
      d1Query(`SELECT id, reason, orderId, status, createdAt FROM disputes ORDER BY createdAt DESC LIMIT 4`),
      d1Query(`SELECT id, bankName, amountKobo, status, createdAt FROM payoutRequests ORDER BY createdAt DESC LIMIT 3`),
    ])

    const totalUsers      = users.length
    const totalSellers    = users.filter((u: any) => u.role === "seller" || u.role === "both").length
    const bannedUsers     = users.filter((u: any) => u.isBanned).length
    const newUsersToday   = users.filter((u: any) => u.createdAt && u.createdAt >= todayISO).length

    const pendingListings = listings.filter((l: any) => l.status === "pending").length
    const activeListings  = listings.filter((l: any) => l.status === "active").length

    const openDisputes          = disputes.filter((d: any) => d.status === "open").length
    const investigatingDisputes = disputes.filter((d: any) => d.status === "investigating").length
    const autoResolvedToday     = disputes.filter((d: any) => d.autoResolved && d.autoResolvedAt && d.autoResolvedAt >= todayISO).length

    let totalGMV = 0, totalCommission = 0
    orders.forEach((o: any) => {
      totalGMV        += Number(o.totalAmount)      || 0
      totalCommission += Number(o.commissionAmount) || 0
    })

    let pendingWithdrawalAmount = 0
    withdrawals.forEach((w: any) => { pendingWithdrawalAmount += Number(w.amount) || 0 })

    let pendingPayoutAmount = 0
    payouts.forEach((p: any) => { pendingPayoutAmount += Number(p.amountKobo) || 0 })

    const stats = {
      totalUsers, newUsersToday, totalSellers, bannedUsers,
      pendingListings, activeListings,
      openDisputes, investigatingDisputes, autoResolvedToday,
      totalGMV, totalCommission,
      pendingWithdrawals: withdrawals.length,
      pendingWithdrawalAmount,
      pendingPayouts: payouts.length,
      pendingPayoutAmount,
      pendingReports: reports.length,
      activeSearchAlerts: searchAlerts.length,
      activeBundles: bundles.length,
    }

    const activity = [
      ...recentUsers.map((d: any) => ({
        id: d.id, type: "user",
        label: `New user: ${d.fullName || "Unknown"}`,
        sub: d.email || "",
        time: d.createdAt,
        badge: d.role,
      })),
      ...recentDisputes.map((d: any) => ({
        id: d.id, type: "dispute",
        label: `Dispute: ${d.reason || "No reason"}`,
        sub: `Order #${String(d.orderId || "").slice(-6).toUpperCase() || "—"}`,
        time: d.createdAt,
        badge: d.status,
      })),
      ...recentPayouts.map((d: any) => ({
        id: d.id, type: "payout",
        label: `Payout request: ${d.bankName}`,
        sub: `₦${((Number(d.amountKobo) || 0) / 100).toLocaleString("en-NG")}`,
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
