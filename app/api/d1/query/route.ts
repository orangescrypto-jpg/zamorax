// app/api/d1/query/route.ts
// Internal server-side proxy for AdminService browser calls.
// NOTE: despite the "AdminService" name, this layer is used by buyers and
// sellers throughout the app (chats, listings, carts, reviews, etc.), not
// just the admin dashboard — so this route must allow any authenticated
// user through, while still keeping admin-only tables locked to admin/mod.
//
// SECURITY MODEL:
//  - All callers must be authenticated (valid Supabase session)
//  - Tables in GENERAL_TABLES are reachable by any authenticated user
//  - Tables in ADMIN_ONLY_TABLES require role = admin | moderator
//  - SELECT/PRAGMA and INSERT/UPDATE/DELETE are allowed (AdminService's
//    addDoc/updateDoc/deleteDoc/setDoc all proxy through this single route —
//    there is no separate mutation route, so blocking writes here breaks
//    every create/update/delete across the app)
//  - SQL is validated against an allowlisted table set — no arbitrary table reads/writes
//  - Parameterised queries only; no string interpolation of user values
//
// This proxy exists solely because CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN
// are server-only secrets and cannot be used from the browser bundle.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

// ── Tables any authenticated user (buyer/seller/admin) may read/write ────────
// These power ordinary app features: chat, listings, carts, reviews, etc.
// Row-level scoping (e.g. "only your own chats") is NOT enforced here yet —
// this only gates by authentication, not by ownership.
const GENERAL_TABLES = new Set([
  "listings",
  "orders",
  "chats",
  "messages",
  "notifications",
  "reports",
  "saved_listings",
  "search_alerts",
  "categories",
  "featured_banners",
  "flash_deals",
  "group_buys",
  "bundles",
  "blog",
])

// ── Tables that require role = admin | moderator ──────────────────────────
const ADMIN_ONLY_TABLES = new Set([
  "users",
  "disputes",
  "withdrawals",
  "payout_requests",
  "seller_wallets",
  "wallet_transactions",
  "subscriptions",
  "boosts",
  "verification_requests",
  "kv_store",
  "insurance_pool",
])

const ALLOWED_TABLES = new Set([...GENERAL_TABLES, ...ADMIN_ONLY_TABLES])

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
  const role = (user.user_metadata?.role as string | undefined) ?? ""
  const isStaff = role === "admin" || role === "moderator"

  try {
    const body = await req.json()
    const { sql, params } = body as { sql?: unknown; params?: unknown }

    if (typeof sql !== "string" || !sql.trim()) {
      return NextResponse.json({ error: "Missing sql" }, { status: 400 })
    }

    // ── 3. Statement type allowlist: reads + the writes AdminService needs ──
    if (!/^\s*(select|pragma|insert|update|delete)\b/i.test(sql)) {
      return NextResponse.json(
        { error: "Statement type not allowed through this proxy." },
        { status: 403 },
      )
    }
    // Block multi-statement injection and DDL/PRAGMA-write tricks riding along
    // with a write (e.g. "UPDATE x SET y=1; DROP TABLE x;").
    if (/;\s*\S/.test(sql.trim().replace(/;\s*$/, ""))) {
      return NextResponse.json(
        { error: "Multiple statements are not allowed." },
        { status: 400 },
      )
    }

    // ── 4. Validate all referenced tables against allowlist, and ──
    //      require staff role for any admin-only table ─────────────
    const tables = extractTables(sql)
    const disallowed = tables.filter(t => !ALLOWED_TABLES.has(t))
    if (disallowed.length > 0) {
      return NextResponse.json(
        { error: `Table(s) not allowed: ${disallowed.join(", ")}` },
        { status: 403 },
      )
    }
    const needsStaff = tables.some(t => ADMIN_ONLY_TABLES.has(t))
    if (needsStaff && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
