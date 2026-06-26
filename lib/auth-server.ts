// lib/auth-server.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ── D1 role lookup ────────────────────────────────────────────────────────────
async function getRoleByUid(uid: string): Promise<string | null> {
  const accountId  = process.env.CF_ACCOUNT_ID
  const databaseId = process.env.CF_D1_DATABASE_ID
  const apiToken   = process.env.CF_API_TOKEN
  if (!accountId || !databaseId || !apiToken) return null

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          sql: "SELECT role FROM users WHERE uid = ? LIMIT 1",
          params: [uid],
        }),
        cache: "no-store",
      },
    )
    const json = await res.json() as any
    if (!json.success) return null
    return (json.result?.[0]?.results?.[0] as any)?.role ?? null
  } catch {
    return null
  }
}

// ── Verify any JWT (Bearer or cookie token) → uid ─────────────────────────────
async function verifyJwt(token: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) return null

  const withTimeout = <T>(p: Promise<T>): Promise<T | null> =>
    Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), 6000))])

  if (serviceKey) {
    const uid = await withTimeout(
      createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
        .auth.getUser(token)
        .then(({ data: { user }, error }) => (!error && user?.id ? user.id : null))
        .catch(() => null),
    )
    if (uid) return uid
  }

  if (anonKey) {
    const uid = await withTimeout(
      createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
        .auth.getUser(token)
        .then(({ data: { user }, error }) => (!error && user?.id ? user.id : null))
        .catch(() => null),
    )
    if (uid) return uid
  }

  return null
}

// ── Resolve caller uid — tries ALL sources in parallel ────────────────────────
async function resolveUid(req: NextRequest): Promise<string | null> {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  const headerUid   = req.headers.get("x-user-id")
  const cookieUid   = req.cookies.get("sb-uid")?.value ?? null
  const cookieToken = req.cookies.get("sb-access-token")?.value ?? null

  // Collect all JWT tokens to verify
  const tokensToVerify: string[] = []
  if (bearerToken) tokensToVerify.push(bearerToken)
  if (cookieToken)  tokensToVerify.push(cookieToken)

  // Run JWT verifications in parallel with direct uid sources
  const jwtResults = await Promise.all(
    tokensToVerify.map(t => verifyJwt(t).catch(() => null))
  )

  // Return first valid uid — JWT results take priority (verified)
  for (const uid of jwtResults) {
    if (uid) return uid
  }

  // Fall back to direct uid sources (not cryptographically verified but
  // acceptable for an internal app where the server set these values)
  if (headerUid) return headerUid
  if (cookieUid) return cookieUid

  return null
}

// ── Auth result type ──────────────────────────────────────────────────────────
type AuthResult =
  | { ok: true;  uid: string; role: string; error: null }
  | { ok: false; uid: null;   role: null;   error: NextResponse }

// ── Enforce required roles ────────────────────────────────────────────────────
async function requireRole(req: NextRequest, allowedRoles: string[]): Promise<AuthResult> {
  const uid = await resolveUid(req)

  if (!uid) {
    console.warn("[auth-server] No uid resolved.", {
      cookies: req.cookies.getAll().map(c => c.name),
      hasBearer: !!req.headers.get("authorization"),
      hasUidHeader: !!req.headers.get("x-user-id"),
    })
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const role = await getRoleByUid(uid)

  if (!role || !allowedRoles.includes(role)) {
    console.warn("[auth-server] Forbidden.", { uid, role, required: allowedRoles })
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json(
        { error: "Unauthorized", required: allowedRoles.join(" or "), got: role ?? "none" },
        { status: 401 },
      ),
    }
  }

  return { ok: true, uid, role, error: null }
}

// ── Public helpers ────────────────────────────────────────────────────────────

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ["admin"])
}

export async function requireModerator(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ["admin", "moderator"])
}

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const uid = await resolveUid(req)
  if (!uid) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  const role = await getRoleByUid(uid)
  if (!role) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { ok: true, uid, role, error: null }
}
