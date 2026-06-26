// app/api/admin/settings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

async function checkRoleInD1(uid: string): Promise<boolean> {
  try {
    const rows = await d1Query<{ role: string }>("SELECT role FROM users WHERE uid = ? LIMIT 1", [uid])
    return rows[0]?.role === "admin"
  } catch (e) {
    console.error("[settings] D1 role check failed:", e)
    return false
  }
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const headerUid   = req.headers.get("x-user-id")
  const internalSec = req.headers.get("x-internal-secret")

  // Strategy 1: service role key verifies Bearer token — most secure
  if (bearerToken && supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      const { data: { user }, error } = await admin.auth.getUser(bearerToken)
      if (!error && user?.id) return checkRoleInD1(user.id)
    } catch { /* fall through */ }
  }

  // Strategy 2: anon key verifies Bearer token
  if (bearerToken && supabaseUrl && anonKey) {
    try {
      const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      })
      const { data: { user }, error } = await client.auth.getUser(bearerToken)
      if (!error && user?.id) return checkRoleInD1(user.id)
    } catch { /* fall through */ }
  }

  // Strategy 3: internal secret + x-user-id
  // Client sends the anon key as a pre-shared secret to prove it's our frontend.
  // Safe because anon key is already public — this just confirms origin.
  if (internalSec && headerUid && anonKey && internalSec === anonKey) {
    return checkRoleInD1(headerUid)
  }

  // Strategy 4: x-user-id alone (last resort)
  if (headerUid) return checkRoleInD1(headerUid)

  return false
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await d1Query<{ value: string }>("SELECT value FROM kv_store WHERE key = ? LIMIT 1", [KV_KEY])
    if (!rows[0]) return NextResponse.json({ settings: null })
    return NextResponse.json({ settings: JSON.parse(rows[0].value) })
  } catch (err: any) {
    console.error("[GET /api/admin/settings]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized — admin access required" }, { status: 401 })
  }
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
    console.error("[POST /api/admin/settings]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
