// lib/auth-server.ts
// Single shared auth helper for ALL admin/moderator API routes.
// Uses @supabase/ssr to read cookies server-side properly.
//
// USAGE in any route:
//
//   import { requireAdmin, requireModerator } from "@/lib/auth-server"
//
//   export async function GET(req: NextRequest) {
//     const { ok, error } = await requireAdmin(req)
//     if (!ok) return error!
//     // ... your logic
//   }

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

// ── Internal: build a Supabase SSR client from the request cookies ────────────
function makeSupabaseServer(req: NextRequest) {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      // We're only reading — no need to set cookies in API routes
      setAll: () => {},
    },
  })
}

// ── Internal: look up the user's role from D1 ─────────────────────────────────
async function getRoleByUid(uid: string): Promise<string | null> {
  try {
    const result = await d1Query(
      "SELECT role FROM users WHERE uid = ? LIMIT 1",
      [uid],
    )
    return (result?.results?.[0] as any)?.role ?? null
  } catch {
    return null
  }
}

// ── Internal: resolve the user's uid from the request ─────────────────────────
// Tries in order:
//   1. @supabase/ssr reads httpOnly cookies properly (sb-access-token)
//   2. Bearer token in Authorization header
//   3. x-user-id header (fast fallback set by our own frontend)
//   4. sb-uid cookie directly (long-lived uid cookie set at login)
async function resolveUid(req: NextRequest): Promise<string | null> {
  // Strategy 1: @supabase/ssr — reads cookies the correct way
  try {
    const supabase = makeSupabaseServer(req)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!error && user?.id) return user.id
  } catch { /* fall through */ }

  // Strategy 2: Bearer token in Authorization header
  const authHeader = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (bearerToken) {
    try {
      const supabase = makeSupabaseServer(req)
      const { data: { user } } = await supabase.auth.getUser(bearerToken)
      if (user?.id) return user.id
    } catch { /* fall through */ }
  }

  // Strategy 3: x-user-id header (Supabase UUID sent by our frontend)
  const headerUid = req.headers.get("x-user-id")
  if (headerUid) return headerUid

  // Strategy 4: sb-uid httpOnly cookie (long-lived, set at login)
  const cookieUid = req.cookies.get("sb-uid")?.value
  if (cookieUid) return cookieUid

  return null
}

// ── Auth result type ──────────────────────────────────────────────────────────
type AuthResult =
  | { ok: true;  uid: string; role: string; error: null }
  | { ok: false; uid: null;   role: null;   error: NextResponse }

// ── Public: require a specific role (or any of several roles) ─────────────────
async function requireRole(req: NextRequest, allowedRoles: string[]): Promise<AuthResult> {
  const uid = await resolveUid(req)

  if (!uid) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized — no session" }, { status: 401 }),
    }
  }

  const role = await getRoleByUid(uid)

  if (!role || !allowedRoles.includes(role)) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json(
        { error: `Forbidden — requires role: ${allowedRoles.join(" or ")}`, got: role },
        { status: 403 },
      ),
    }
  }

  return { ok: true, uid, role, error: null }
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Admin only */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ["admin"])
}

/** Moderator or admin */
export async function requireModerator(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ["admin", "moderator"])
}

/** Any authenticated user */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const uid = await resolveUid(req)
  if (!uid) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized — no session" }, { status: 401 }),
    }
  }
  const role = await getRoleByUid(uid)
  if (!role) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized — user not found" }, { status: 401 }),
    }
  }
  return { ok: true, uid, role, error: null }
}
