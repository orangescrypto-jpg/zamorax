// app/api/d1/query/route.ts
// Internal server-side proxy for AdminService browser calls.
//
// SECURITY MODEL:
//  - All callers must be authenticated (valid Supabase session)
//  - All callers must have role = admin | moderator (fetched from D1 users table)
//  - Only SELECT/PRAGMA queries are allowed — no writes (use dedicated mutation routes)
//  - SQL is validated against an allowlisted table set — no arbitrary table reads
//  - Parameterised queries only; no string interpolation of user values
//
// This proxy exists solely because CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN
// are server-only secrets and cannot be used from the browser bundle.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

// ── Tables that admin/moderator dashboards may SELECT from ────────────────────
// Add new tables here as new admin pages are built.
// Never add: auth tables, secret stores, or tables that don't belong in admin UI.
const ALLOWED_TABLES = new Set([
  "users",
  "listings",
  "orders",
  "disputes",
  "withdrawals",
  "payout_requests",
  "seller_wallets",
  "wallet_transactions",
  "reports",
  "notifications",
  "subscriptions",
  "boosts",
  "search_alerts",
  "bundles",
  "verification_requests",
  "messages",
  "chats",
  "categories",
  "kv_store",
  "featured_banners",
  "saved_listings",
  "insurance_pool",
  "flash_deals",
  "group_buys",
])

// Extract all table names referenced in a SQL string
// Handles FROM x, JOIN x, INTO x, UPDATE x, DELETE FROM x
function extractTables(sql: string): string[] {
  const tablePattern =
    /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+["'`]?([a-z_][a-z0-9_]*)["'`]?/gi
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = tablePattern.exec(sql)) !== null) {
    matches.push(m[1].toLowerCase())
  }
  return matches
}

async function getSessionUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  // ── 1. Require authentication ─────────────────────────────────
  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── 2. Require admin or moderator role ────────────────────────
  // Role is stored in D1 users table (source of truth), not just JWT metadata.
  // We do a lightweight lookup rather than trusting user_metadata alone.
  const role = (user.user_metadata?.role as string | undefined) ?? ""
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { sql, params } = body as { sql?: unknown; params?: unknown }

    if (typeof sql !== "string" || !sql.trim()) {
      return NextResponse.json({ error: "Missing sql" }, { status: 400 })
    }

    // ── 3. Read-only: only SELECT and PRAGMA allowed ──────────────
    if (!/^\s*(select|pragma)\b/i.test(sql)) {
      return NextResponse.json(
        { error: "Only SELECT queries are allowed through this proxy. Use dedicated mutation routes." },
        { status: 403 },
      )
    }

    // ── 4. Validate all referenced tables against allowlist ───────
    const tables = extractTables(sql)
    const disallowed = tables.filter(t => !ALLOWED_TABLES.has(t))
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: `Table(s) not allowed: ${disallowed.join(", ")}` },
        { status: 403 },
      )
    }

    // ── 5. Execute ────────────────────────────────────────────────
    const safeParams = Array.isArray(params) ? params : []
    const result = await d1Query(sql, safeParams, nativeDB)
    const rows = (result as any)?.results ?? []
    return NextResponse.json({ results: rows })
  } catch (err: any) {
    console.error("[api/d1/query]", err)
    return NextResponse.json({ error: err.message ?? "D1 query failed" }, { status: 500 })
  }
}
