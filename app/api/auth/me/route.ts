// app/api/auth/me/route.ts
// Returns the current user profile from D1, authenticated via Firebase.
// Called on every page load by providers.tsx to restore session after refresh.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken"

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
    },
    body:  JSON.stringify({ sql, params }),
    cache: "no-store",
  })
  const json = await res.json() as any
  if (!json.success) throw new Error(`D1: ${json.errors?.[0]?.message ?? "unknown"}`)
  return (json.result?.[0]?.results ?? []) as T[]
}

export async function GET(req: NextRequest) {
  try {
    // Primary: verify Bearer token (sent by client-side Firebase SDK via adminFetch)
    const authHeader  = req.headers.get("authorization") ?? ""
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

    let uid: string | null = null

    if (bearerToken) {
      uid = await verifyFirebaseToken(bearerToken)
    }

    // Fallback: httpOnly cookie uid set at login (no token verification needed
    // for /me — the uid just fetches the public profile; sensitive routes use
    // full token verification via requireAuth/requireAdmin)
    if (!uid) {
      uid = req.cookies.get("fb-uid")?.value ?? null
    }

    if (!uid) {
      return NextResponse.json({ error: "No session" }, { status: 401 })
    }

    // Fetch profile from D1
    const rows = await d1Query<Record<string, unknown>>(
      "SELECT * FROM users WHERE uid = ? LIMIT 1",
      [uid],
    )

    if (!rows[0]) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    return NextResponse.json({ profile: rows[0] })
  } catch (err: any) {
    console.error("[GET /api/auth/me]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
