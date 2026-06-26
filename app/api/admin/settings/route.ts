// app/api/admin/settings/route.ts
// Auth priority:
//  1. Bearer JWT verified via service role key
//  2. Bearer JWT verified via anon key  
//  3. sb-access-token httpOnly cookie (set by login route)
//  4. sb-uid httpOnly cookie + x-internal-secret
//  5. x-user-id header + x-internal-secret (last resort)
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

async function checkRoleByUid(uid: string): Promise<boolean> {
  try {
    const rows = await d1Query<{ role: string }>("SELECT role FROM users WHERE uid = ? LIMIT 1", [uid])
    return rows[0]?.role === "admin"
  } catch { return false }
}

async function verifyJwt(token: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) return null

  if (serviceKey) {
    try {
      const { data: { user }, error } = await createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).auth.getUser(token)
      if (!error && user?.id) return user.id
    } catch { /* fall through */ }
  }

  if (anonKey) {
    try {
      const { data: { user }, error } = await createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }).auth.getUser(token)
      if (!error && user?.id) return user.id
    } catch { /* fall through */ }
  }

  return null
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const headerUid   = req.headers.get("x-user-id")
  const internalSec = req.headers.get("x-internal-secret")
  const cookieToken = req.cookies.get("sb-access-token")?.value ?? null
  const cookieUid   = req.cookies.get("sb-uid")?.value ?? null

  // 1 & 2: Bearer token from Authorization header
  if (bearerToken) {
    const uid = await verifyJwt(bearerToken)
    if (uid && await checkRoleByUid(uid)) return true
  }

  // 3: httpOnly cookie token (set by login route — most reliable)
  if (cookieToken) {
    const uid = await verifyJwt(cookieToken)
    if (uid && await checkRoleByUid(uid)) return true
  }

  // 4: sb-uid cookie (set by login route) + internal secret
  if (cookieUid && internalSec && anonKey && internalSec === anonKey) {
    if (await checkRoleByUid(cookieUid)) return true
  }

  // 5: x-user-id header + internal secret (last resort for stale sessions)
  if (headerUid && internalSec && anonKey && internalSec === anonKey) {
    if (await checkRoleByUid(headerUid)) return true
  }

  console.warn("[settings] All auth strategies failed", {
    hasBearer: !!bearerToken,
    hasCookieToken: !!cookieToken,
    hasCookieUid: !!cookieUid,
    hasHeaderUid: !!headerUid,
    secretMatch: internalSec === anonKey,
  })
  return false
}

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
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
