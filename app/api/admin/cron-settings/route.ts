// app/api/admin/cron-settings/route.ts
// Admin-only. Generates, saves, and displays the secret used to authorise
// cron endpoints. GET returns the current secret in full (unlike VAPID
// private keys, this value needs to be copied into cron-job.org, so it is
// shown, not hidden) plus whether it came from the database or the
// environment variable fallback.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getCronSecret } from "@/lib/cron-secret"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function ensureTable(nativeDB?: unknown) {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS cron_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      secret TEXT, updated_at TEXT DEFAULT (datetime('now'))
    )`,
    [],
    nativeDB,
  )
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    await ensureTable(nativeDB)
    const rows = await d1Query("SELECT secret FROM cron_settings WHERE id = 'default' LIMIT 1", [], nativeDB)
    const dbSecret = (rows?.results?.[0] as any)?.secret || null

    return NextResponse.json({
      secret: dbSecret || process.env.CRON_SECRET || null,
      source: dbSecret ? "database" : (process.env.CRON_SECRET ? "env" : "none"),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Generates a new random secret and saves it, replacing any previous one.
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    await ensureTable(nativeDB)

    const body = await req.json().catch(() => ({}))
    const secret = body?.secret && String(body.secret).length >= 16
      ? String(body.secret)
      : crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")

    const now = new Date().toISOString()
    const existing = await d1Query("SELECT id FROM cron_settings WHERE id = 'default' LIMIT 1", [], nativeDB)

    if (existing?.results?.[0]) {
      await d1Query("UPDATE cron_settings SET secret = ?, updated_at = ? WHERE id = 'default'", [secret, now], nativeDB)
    } else {
      await d1Query("INSERT INTO cron_settings (id, secret, updated_at) VALUES ('default', ?, ?)", [secret, now], nativeDB)
    }

    return NextResponse.json({ success: true, secret })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
