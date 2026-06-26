// app/api/admin/settings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken"

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
  await d1Query(`CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`)
}

async function checkRoleByUid(uid: string): Promise<string | null> {
  try {
    const rows = await d1Query<{ role: string }>("SELECT role FROM users WHERE uid = ? LIMIT 1", [uid])
    return rows[0]?.role ?? null
  } catch { return null }
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const headerUid   = req.headers.get("x-user-id")
  const cookieUid   = req.cookies.get("fb-uid")?.value ?? null

  const uids: (string | null)[] = []

  if (bearerToken) {
    const uid = await verifyFirebaseToken(bearerToken)
    uids.push(uid)
  }
  if (headerUid) uids.push(headerUid)
  if (cookieUid) uids.push(cookieUid)

  const roleChecks = await Promise.all(
    uids.filter(Boolean).map(uid => checkRoleByUid(uid!))
  )

  return roleChecks.some(role => role === "admin")
}

// ── GET — public ──────────────────────────────────────────────────────────────
export async function GET() {
  try {
    await ensureTable()
    const rows = await d1Query<{ value: string }>("SELECT value FROM kv_store WHERE key = ? LIMIT 1", [KV_KEY])
    if (!rows[0]) return NextResponse.json({ settings: null })
    return NextResponse.json({ settings: JSON.parse(rows[0].value) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — admin only ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ok = await isAdmin(req)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    await ensureTable()
    const now   = new Date().toISOString()
    const value = JSON.stringify({ ...body, updatedAt: now })
    const existing = await d1Query("SELECT key FROM kv_store WHERE key = ? LIMIT 1", [KV_KEY])
    if (existing[0]) {
      await d1Query("UPDATE kv_store SET value = ?, updated_at = ? WHERE key = ?", [value, now, KV_KEY])
    } else {
      await d1Query("INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)", [KV_KEY, value, now])
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
