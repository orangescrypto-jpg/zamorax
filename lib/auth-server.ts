// lib/auth-server.ts  — REPLACE EXISTING FILE
// Server-side auth helpers for API routes.
// Verifies Supabase session from cookies, looks up role from D1.

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

// ── Build a Supabase client from a raw NextRequest (no next/headers) ──────────
function buildSupabaseFromRequest(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll() {
          // Read-only in API route context — session refresh handled by middleware
        },
      },
    },
  )
}

// ── Role lookup from D1 ───────────────────────────────────────────────────────
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
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${apiToken}`,
        },
        body:  JSON.stringify({ sql: "SELECT role FROM users WHERE uid = ? LIMIT 1", params: [uid] }),
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

// ── Auth result type ──────────────────────────────────────────────────────────
type AuthResult =
  | { ok: true;  uid: string; role: string; error: null }
  | { ok: false; uid: null;   role: null;   error: NextResponse }

// ── Core resolver ─────────────────────────────────────────────────────────────
async function requireRole(req: NextRequest, allowedRoles: string[]): Promise<AuthResult> {
  const supabase = buildSupabaseFromRequest(req)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  // Role is stored in user_metadata (set on register) AND in D1.
  // Use D1 as source of truth so admins can change roles without re-registering.
  const role = await getRoleByUid(user.id)

  if (!role || !allowedRoles.includes(role)) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json(
        { error: "Unauthorized", required: allowedRoles.join(" or "), got: role ?? "none" },
        { status: 401 },
      ),
    }
  }

  return { ok: true, uid: user.id, role, error: null }
}

// ── Public helpers ────────────────────────────────────────────────────────────

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ["admin"])
}

export async function requireModerator(req: NextRequest): Promise<AuthResult> {
  return requireRole(req, ["admin", "moderator"])
}

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const supabase = buildSupabaseFromRequest(req)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const role = await getRoleByUid(user.id)
  if (!role) {
    return {
      ok: false, uid: null, role: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { ok: true, uid: user.id, role, error: null }
}
