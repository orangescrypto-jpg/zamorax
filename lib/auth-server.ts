// lib/auth-server.ts
// Server-side auth helpers for API routes.
// Verifies Firebase ID tokens from the Authorization header,
// then looks up the user role from Cloudflare D1.

import { NextRequest, NextResponse } from "next/server"
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken"

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

// ── Resolve caller uid from Firebase ID token ─────────────────────────────────
async function resolveUid(req: NextRequest): Promise<string | null> {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  // Cookie fallback — set by /api/auth/login
  const cookieUid = req.cookies.get("fb-uid")?.value ?? null

  if (bearerToken) {
    const uid = await verifyFirebaseToken(bearerToken)
    if (uid) return uid
  }

  // Fall back to cookie uid (set at login, httpOnly)
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
      cookies:     req.cookies.getAll().map(c => c.name),
      hasBearer:   !!req.headers.get("authorization"),
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
