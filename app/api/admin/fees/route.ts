// app/api/admin/fees/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

// Merges Next.js required context shape with Cloudflare Pages env binding.
// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

// FIX: this previously used its own key "platform_fees", completely
// separate from the key everything else in the app actually reads.
// useFeeSettings() -> getFeeSettings() -> AdminService.getDoc("config", "fees")
// -> kvGet("fees") -> reads kv_store row with key "config:fees". FeeBreakdown,
// BuyNowModal, CartCheckoutModal, and the seller earnings page all go through
// that same path. Because this route wrote to "platform_fees" instead, every
// change an admin made on /admin/fees was saved but never actually read by
// anything — the rest of the app silently kept using DEFAULT_FEE_SETTINGS
// (4% commission / 0.5% arbitration) forever. Aligning the key here makes
// admin edits actually take effect everywhere.
const KV_KEY = "config:fees"

async function ensureTable(nativeDB?: unknown) {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
    [],
    nativeDB,
  )
}

// ── GET — public ──────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    await ensureTable(nativeDB)
    const rows = await d1Query(
      "SELECT value FROM kv_store WHERE key = ? LIMIT 1",
      [KV_KEY],
      nativeDB,
    )
    const row = rows?.results?.[0] as { value: string } | undefined
    if (!row) return NextResponse.json({ fees: null })
    return NextResponse.json({ fees: JSON.parse(row.value) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — admin only ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest, context: RouteContext) {
  const { ok, error } = await requireAdmin(req)
  if (!ok) return error!

  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    await ensureTable(nativeDB)
    const now   = new Date().toISOString()
    const value = JSON.stringify({ ...body, updatedAt: now })

    const existing = await d1Query(
      "SELECT key FROM kv_store WHERE key = ? LIMIT 1",
      [KV_KEY],
      nativeDB,
    )
    if (existing?.results?.[0]) {
      await d1Query(
        "UPDATE kv_store SET value = ?, updated_at = ? WHERE key = ?",
        [value, now, KV_KEY],
        nativeDB,
      )
    } else {
      await d1Query(
        "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)",
        [KV_KEY, value, now],
        nativeDB,
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
