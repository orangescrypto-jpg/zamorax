// app/api/admin/fees/route.ts
// Server-side route for saving fee settings to D1 (kv_store).
// Mirrors /api/admin/settings/route.ts auth pattern. Created because the
// fees page was calling AdminService.setDoc() directly from the client,
// which fails since CF_API_TOKEN/CF_ACCOUNT_ID/CF_D1_DATABASE_ID are
// server-only env vars (undefined in the browser bundle) -> Cloudflare
// rejects the unauthenticated request -> shows as "Unauthorized" in the UI.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const KV_KEY = "platform_fees"

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

async function checkRoleByUid(uid: string, retries = 2): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const rows = await d1Query<{ role: string }>("SELECT role FROM users WHERE uid = ? LIMIT 1", [uid])
      return rows[0]?.role === "admin"
    } catch {
      if (attempt === retries) return false
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  return false
}

async function verifyJwt(token: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) return null

  const race = <T>(p: Promise<T>): Promise<T | null> =>
    Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), 9000))])

  if (serviceKey) {
    const uid = await race(
      createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
        .auth.getUser(token)
        .then(({ data: { user }, error }) => (!error && user?.id ? user.id : null))
        .catch(() => null)
    )
    if (uid) return uid
  }

  if (anonKey) {
    const uid = await race(
      createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
        .auth.getUser(token)
        .then(({ data: { user }, error }) => (!error && user?.id ? user.id : null))
        .catch(() => null)
    )
    if (uid) return uid
  }

  return null
}

async function isAdmin(req: NextRequest): Promise<{ ok: boolean }> {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const cookieToken = req.cookies.get("sb-access-token")?.value ?? null
  const cookieUid   = req.cookies.get("sb-uid")?.value ?? null
  const headerUid   = req.headers.get("x-user-id")

  const fastCheck      = cookieUid ? checkRoleByUid(cookieUid) : Promise.resolve(false)
  const uidHeaderCheck = headerUid ? checkRoleByUid(headerUid) : Promise.resolve(false)

  const jwtChecks: Promise<boolean>[] = []
  if (bearerToken) {
    jwtChecks.push(verifyJwt(bearerToken).then(uid => uid ? checkRoleByUid(uid) : false).catch(() => false))
  }
  if (cookieToken) {
    jwtChecks.push(verifyJwt(cookieToken).then(uid => uid ? checkRoleByUid(uid) : false).catch(() => false))
  }

  const results = await Promise.allSettled([fastCheck, uidHeaderCheck, ...jwtChecks])
  for (const r of results) {
    if (r.status === "fulfilled" && r.value === true) return { ok: true }
  }
  return { ok: false }
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await d1Query<{ value: string }>("SELECT value FROM kv_store WHERE key = ? LIMIT 1", [KV_KEY])
    if (!rows[0]) return NextResponse.json({ fees: null })
    return NextResponse.json({ fees: JSON.parse(rows[0].value) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { ok } = await isAdmin(req)
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
