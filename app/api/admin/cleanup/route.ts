// app/api/admin/cleanup/route.ts
// Admin-only. GET returns the saved windows, their defaults and limits, and
// cheap row counts for the Storage & Cleanup page. PUT saves new windows.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import {
  DEFAULT_SETTINGS,
  JOBS,
  getCleanupSettings,
  saveCleanupSettings,
  type JobKey,
} from "@/lib/cleanup/settings"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

/** Table -> label. Counts are plain COUNT(*) so the page can show how big each table is. */
const COUNT_TABLES: Array<{ table: string; label: string }> = [
  { table: "notifications", label: "Notifications" },
  { table: "messages", label: "Messages" },
  { table: "chats", label: "Chats" },
  { table: "offers", label: "Offers" },
  { table: "orders", label: "Orders" },
  { table: "wallet_transactions", label: "Transactions" },
  { table: "listings", label: "Listings" },
  { table: "pending_payments", label: "Payment attempts" },
  { table: "reports", label: "Reports" },
  { table: "listing_reports", label: "Listing reports" },
  { table: "media_library", label: "Image library" },
  { table: "rate_limits", label: "Rate-limit rows" },
]

async function counts(nativeDB?: unknown) {
  const out: Array<{ table: string; label: string; count: number | null }> = []
  for (const { table, label } of COUNT_TABLES) {
    try {
      const res = await d1Query(`SELECT COUNT(*) AS n FROM ${table}`, [], nativeDB)
      out.push({ table, label, count: Number((res?.results?.[0] as any)?.n ?? 0) })
    } catch {
      out.push({ table, label, count: null }) // table does not exist here
    }
  }
  return out
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error
  const nativeDB = (context as any)?.env?.DB
  try {
    const settings = await getCleanupSettings(nativeDB)
    return NextResponse.json({
      settings,
      defaults: DEFAULT_SETTINGS,
      jobs: JOBS,
      counts: await counts(nativeDB),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error
  const nativeDB = (context as any)?.env?.DB

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const known = new Set<string>(JOBS.map((j) => j.key))
  const input: Partial<Record<JobKey, unknown>> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!known.has(k)) continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 3650) {
      return NextResponse.json({ error: `${k} must be a number from 0 to 3650 (0 = never delete)` }, { status: 400 })
    }
    input[k as JobKey] = n
  }
  try {
    const saved = await saveCleanupSettings(input, nativeDB)
    return NextResponse.json({ settings: saved })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
