// app/api/seller/settings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function getAuthedUid(req: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

const kvKey = (uid: string) => `seller_settings:${uid}`

export async function GET(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const uid = await getAuthedUid(req)
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await d1Query(
      `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
      [], nativeDB
    )
    const rows = await d1Query(
      `SELECT value FROM kv_store WHERE key = ? LIMIT 1`,
      [kvKey(uid)], nativeDB
    )
    const settings = (rows as any)?.results?.[0]?.value
      ? JSON.parse((rows as any).results[0].value)
      : null
    return NextResponse.json({ settings })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const uid = await getAuthedUid(req)
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { settings } = await req.json()
    if (!settings) return NextResponse.json({ error: "Missing settings" }, { status: 400 })

    const now = new Date().toISOString()
    await d1Query(
      `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
      [], nativeDB
    )
    await d1Query(
      `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [kvKey(uid), JSON.stringify(settings), now], nativeDB
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
