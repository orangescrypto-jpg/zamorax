// app/api/admin/settings/route.ts
// Admin Platform Settings — full read/write.
// Stores the entire settings object as ONE JSON blob in a generic
// key-value table (kv_store), instead of one D1 column per field.
//
// AUTH: POST requires the caller to send `x-user-id` header (the Firebase uid
// stored in authStore). We verify that user's role = "admin" in D1 before
// allowing the write. GET is public (used by getPlatformSettings on the server).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

const KV_KEY = "platform_settings"

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

async function ensureTable() {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    )`
  )
}

/** Verify the requesting user is an admin. Returns true if authorised. */
async function isAdmin(req: NextRequest): Promise<boolean> {
  const uid = req.headers.get("x-user-id")
  if (!uid) return false
  try {
    const rows = await d1Query<{ role: string }>(
      `SELECT role FROM users WHERE id = ? LIMIT 1`,
      [uid]
    )
    return rows[0]?.role === "admin"
  } catch {
    return false
  }
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await d1Query<{ value: string }>(
      `SELECT value FROM kv_store WHERE key = ? LIMIT 1`,
      [KV_KEY]
    )
    if (!rows[0]) return NextResponse.json({ settings: null })
    return NextResponse.json({ settings: JSON.parse(rows[0].value) })
  } catch (err: any) {
    console.error("[GET /api/admin/settings]", err)
    return NextResponse.json({ error: err.message ?? "Unknown server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // ── Admin guard ────────────────────────────────────────────────
  if (!(await isAdmin(req))) {
    return NextResponse.json(
      { error: "Unauthorized — admin access required" },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 })
    }
    await ensureTable()
    const now = new Date().toISOString()
    const value = JSON.stringify({ ...body, updatedAt: now })

    const existing = await d1Query(`SELECT key FROM kv_store WHERE key = ? LIMIT 1`, [KV_KEY])
    if (existing[0]) {
      await d1Query(`UPDATE kv_store SET value = ?, updated_at = ? WHERE key = ?`, [value, now, KV_KEY])
    } else {
      await d1Query(`INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)`, [KV_KEY, value, now])
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[POST /api/admin/settings]", err)
    return NextResponse.json({ error: err.message ?? "Unknown server error" }, { status: 500 })
  }
}
