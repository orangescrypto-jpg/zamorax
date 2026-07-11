// app/api/admin/sub-settings/route.ts
// Same generic kv_store pattern as /api/admin/settings, but its own key so
// it never collides with the main config/platform doc. This is the route
// for "Sub Settings" — anything small/misc added after the main settings
// page grew too large. Add new fields freely; no schema migration needed
// since the whole object is stored as one JSON blob.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const KV_KEY = "sub_settings"

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
    if (!row) return NextResponse.json({ settings: null })
    return NextResponse.json({ settings: JSON.parse(row.value) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — admin only ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest, context: RouteContext) {
  let auth: Awaited<ReturnType<typeof requireAdmin>>
  try {
    auth = await requireAdmin(req)
  } catch (err: any) {
    console.error("[admin/sub-settings] requireAdmin() crashed:", err)
    return NextResponse.json(
      { error: "Auth check failed", debug: { message: err.message ?? String(err) } },
      { status: 500 },
    )
  }
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    if (!body || typeof body !== "object")
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

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
