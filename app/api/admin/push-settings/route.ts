// app/api/admin/push-settings/route.ts
// Admin-only read/write of the VAPID key pair used for Web Push.
// GET returns whether keys are set and their source (database vs env
// fallback) but never returns the private key to the browser.
// POST saves a new key pair (from generate, or pasted in manually) plus
// the contact subject required by the Web Push protocol.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getVapidKeys } from "@/lib/push-vapid"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

async function ensureTable(nativeDB?: unknown) {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS push_vapid_keys (
      id TEXT PRIMARY KEY DEFAULT 'default',
      public_key TEXT, private_key TEXT, subject TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    [],
    nativeDB,
  )
}

// ── GET -- admin only. Never exposes the private key. ───────────────────
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const keys = await getVapidKeys(nativeDB)
    return NextResponse.json({
      configured: !!keys.publicKey && !!keys.privateKey,
      source: keys.source,
      publicKey: keys.publicKey || null,
      subject: keys.subject || null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST -- admin only. Saves public key, private key, and subject. ─────
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    const { publicKey, privateKey, subject } = body || {}

    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: "publicKey and privateKey required" }, { status: 400 })
    }
    if (!subject || !String(subject).startsWith("mailto:")) {
      return NextResponse.json(
        { error: "subject must be a mailto: address, e.g. mailto:support@zamorax.com" },
        { status: 400 },
      )
    }

    await ensureTable(nativeDB)
    const now = new Date().toISOString()

    const existing = await d1Query(
      "SELECT id FROM push_vapid_keys WHERE id = 'default' LIMIT 1",
      [],
      nativeDB,
    )
    if (existing?.results?.[0]) {
      await d1Query(
        "UPDATE push_vapid_keys SET public_key = ?, private_key = ?, subject = ?, updated_at = ? WHERE id = 'default'",
        [publicKey, privateKey, subject, now],
        nativeDB,
      )
    } else {
      await d1Query(
        "INSERT INTO push_vapid_keys (id, public_key, private_key, subject, updated_at) VALUES ('default', ?, ?, ?, ?)",
        [publicKey, privateKey, subject, now],
        nativeDB,
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[admin/push-settings POST]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── DELETE -- admin only. Clears saved keys, reverting to env fallback. ─
export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    await ensureTable(nativeDB)
    await d1Query("DELETE FROM push_vapid_keys WHERE id = 'default'", [], nativeDB)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
