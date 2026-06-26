// app/api/admin/make-admin/route.ts
// ─────────────────────────────────────────────────────────────────
// ONE-TIME bootstrap route to promote a user to admin role.
// Protected by ADMIN_BOOTSTRAP_SECRET env variable.
//
// Usage (from your browser or curl):
//   POST /api/admin/make-admin
//   Body: { "uid": "<your-supabase-uid>", "secret": "<ADMIN_BOOTSTRAP_SECRET>" }
//
// After promoting yourself, delete or disable this route.
// ─────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { uid, secret } = body

    // Guard: must match ADMIN_BOOTSTRAP_SECRET env var
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET
    if (!bootstrapSecret) {
      return NextResponse.json(
        { error: "ADMIN_BOOTSTRAP_SECRET is not set in environment variables" },
        { status: 500 }
      )
    }
    if (!secret || secret !== bootstrapSecret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 403 })
    }
    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 })
    }

    // Check user exists
    const result = await d1Query("SELECT uid, email, role FROM users WHERE uid = ? LIMIT 1", [uid])
    const user = result?.results?.[0] as any
    if (!user) {
      return NextResponse.json({ error: `No user found with uid: ${uid}` }, { status: 404 })
    }

    // Promote to admin
    await d1Query(
      "UPDATE users SET role = ?, updated_at = ? WHERE uid = ?",
      ["admin", new Date().toISOString(), uid]
    )

    return NextResponse.json({
      success: true,
      message: `User ${user.email} promoted to admin`,
      previousRole: user.role,
      newRole: "admin",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET: look up a user's current role (useful for debugging)
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid")
  const secret = req.nextUrl.searchParams.get("secret")

  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET
  if (!bootstrapSecret || !secret || secret !== bootstrapSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 })
  }
  if (!uid) {
    return NextResponse.json({ error: "uid param required" }, { status: 400 })
  }

  const result = await d1Query("SELECT uid, email, role FROM users WHERE uid = ? LIMIT 1", [uid])
  const user = result?.results?.[0]
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  return NextResponse.json(user)
}
