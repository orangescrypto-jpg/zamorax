// app/api/push/subscribe/route.ts
// Saves a browser's PushSubscription against the logged in user. A user
// can hold several subscriptions (phone, laptop, etc) -- upserted by
// endpoint, not by user, so re-subscribing on the same device updates the
// existing row instead of creating a duplicate.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function ensureTable(nativeDB?: unknown) {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    )`,
    [],
    nativeDB,
  )
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    const subscription = body?.subscription
    const endpoint = subscription?.endpoint
    const p256dh = subscription?.keys?.p256dh
    const authKey = subscription?.keys?.auth

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 })
    }

    await ensureTable(nativeDB)
    const now = new Date().toISOString()
    const userAgent = req.headers.get("user-agent") || null

    const existing = await d1Query(
      "SELECT id FROM push_subscriptions WHERE endpoint = ? LIMIT 1",
      [endpoint],
      nativeDB,
    )

    if (existing?.results?.[0]) {
      await d1Query(
        "UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = ? WHERE endpoint = ?",
        [auth.uid, p256dh, authKey, userAgent, now, endpoint],
        nativeDB,
      )
    } else {
      await d1Query(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), auth.uid, endpoint, p256dh, authKey, userAgent, now, now],
        nativeDB,
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[push/subscribe]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
