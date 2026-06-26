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

async function checkRoleByUid(uid: string): Promise<boolean> {
  try {
    const rows = await d1Query<{ role: string }>("SELECT role FROM users WHERE uid = ? LIMIT 1", [uid])
    return rows[0]?.role === "admin"
  } catch { return false }
}

async function verifyJwtWithTimeout(token: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) return null

  const timeout = new Promise<null>(res => setTimeout(() => res(null), 4000))

  const jwtCheck = (async () => {
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
  })()

  return Promise.race([jwtCheck, timeout])
}

async function isAdmin(req: NextRequest): Promise<{ ok: boolean; debug: Record<string, unknown> }> {
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const headerUid   = req.headers.get("x-user-id")
  const internalSec = req.headers.get("x-internal-secret")
  const cookieToken = req.cookies.get("sb-access-token")?.value ?? null
  const cookieUid   = req.cookies.get("sb-uid")?.value ?? null
  const secretMatch = !!(internalSec && anonKey && internalSec === anonKey)

  const debug: Record<string, unknown> = {
    hasBearer: !!bearerToken,
    hasCookieToken: !!cookieToken,
    hasCookieUid: !!cookieUid,
    hasHeaderUid: !!headerUid,
    secretMatch,
  }

  // Run D1-only checks (fast, no Supabase network call) in parallel with JWT verification
  // This prevents Supabase timeouts from blocking the cookie-based fallback.
  const fastChecks: Promise<{ ok: boolean; via: string }>[] = []

  // Fast path 1: sb-uid cookie (httpOnly — can't be forged by JS)
  if (cookieUid) {
    fastChecks.push(
      checkRoleByUid(cookieUid).then(ok => ({ ok, via: "sb-uid-cookie" }))
    )
  }

  // Fast path 2: x-user-id header + secret match
  if (headerUid && secretMatch) {
    fastChecks.push(
      checkRoleByUid(headerUid).then(ok => ({ ok, via: "x-user-id+secret" }))
    )
  }

  // Slow path: JWT verification (may timeout)
  const jwtChecks: Promise<{ ok: boolean; via: string }>[] = []

  if (bearerToken) {
    jwtChecks.push(
      verifyJwtWithTimeout(bearerToken).then(async uid => {
        if (!uid) return { ok: false, via: "bearer-jwt-failed" }
        const ok = await checkRoleByUid(uid)
        return { ok, via: "bearer-jwt" }
      })
    )
  }

  if (cookieToken) {
    jwtChecks.push(
      verifyJwtWithTimeout(cookieToken).then(async uid => {
        if (!uid) return { ok: false, via: "cookie-token-jwt-failed" }
        const ok = await checkRoleByUid(uid)
        return { ok, via: "cookie-token-jwt" }
      })
    )
  }

  // Race: first passing check wins
  const allChecks = [...fastChecks, ...jwtChecks]
  if (allChecks.length === 0) {
    debug.reason = "no credentials"
    return { ok: false, debug }
  }

  // Use Promise.allSettled so a timeout doesn't prevent other checks from resolving
  const results = await Promise.allSettled(allChecks)
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.ok) {
      debug.passedVia = r.value.via
      return { ok: true, debug }
    }
  }

  debug.reason = "all checks failed"
  console.warn("[settings] All auth strategies failed", debug)
  return { ok: false, debug }
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
  const { ok, debug } = await isAdmin(req)

  if (!ok) {
    return NextResponse.json(
      { error: "Unauthorized — admin access required", debug },
      { status: 401 },
    )
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
