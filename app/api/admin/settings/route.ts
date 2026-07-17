// app/api/admin/settings/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

// Merges Next.js required context shape with Cloudflare Pages env binding.
// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const KV_KEY = "platform_settings"

async function ensureTable(nativeDB?: unknown) {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)`,
    [],
    nativeDB,
  )
}

// ── GET — public ──────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    await ensureTable(nativeDB)
    const rows = await d1Query(
      "SELECT value FROM kv_store WHERE key = ? LIMIT 1",
      [KV_KEY],
      nativeDB,
    )
    const row = rows?.results?.[0] as { value: string } | undefined
    if (!row) return NextResponse.json({ settings: null })
    return NextResponse.json({ settings: JSON.parse(row.value) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — admin only ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest, context: RouteContext) {
  let auth: Awaited<ReturnType<typeof requireAdmin>>
  try {
    auth = await requireAdmin(req)
  } catch (err: any) {
    console.error("[admin/settings] requireAdmin() crashed:", err)
    return NextResponse.json(
      { error: "Auth check failed", debug: { message: err.message ?? String(err) } },
      { status: 500 },
    )
  }
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const body = await req.json()
    if (!body || typeof body !== "object")
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })

    // At least one payment method must remain enabled — otherwise checkout
    // has nowhere to send buyers. The admin UI already blocks this, but guard
    // here too since settings can theoretically be posted directly.
    // Any prior request shape (before the card/bank split existed) may only
    // send manualPaymentEnabled/paystackPaymentEnabled — fall back to those
    // so old admin UI payloads don't get rejected.
    const manualOn      = body.manualPaymentEnabled ?? true
    const cardOn        = body.paystackCardEnabled ?? body.paystackPaymentEnabled ?? false
    const bankOn        = body.paystackBankEnabled ?? false
    const flutterwaveOn = body.flutterwavePaymentEnabled ?? false
    if (!manualOn && !cardOn && !bankOn && !flutterwaveOn) {
      return NextResponse.json(
        { error: "At least one payment method (Manual, Card, Bank Online, or Flutterwave) must stay enabled." },
        { status: 400 },
      )
    }
    // Derived legacy flag — old code paths only check "is Paystack on at all".
    body.paystackPaymentEnabled    = cardOn || bankOn
    body.paystackCardEnabled       = cardOn
    body.paystackBankEnabled       = bankOn
    body.flutterwavePaymentEnabled = flutterwaveOn

    await ensureTable(nativeDB)
    const now   = new Date().toISOString()
    const value = JSON.stringify({ ...body, updatedAt: now })

    const existing = await d1Query(
      "SELECT key FROM kv_store WHERE key = ? LIMIT 1",
      [KV_KEY],
      nativeDB,
    )
    if (existing?.results?.[0]) {
      await d1Query(
        "UPDATE kv_store SET value = ?, updated_at = ? WHERE key = ?",
        [value, now, KV_KEY],
        nativeDB,
      )
    } else {
      await d1Query(
        "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)",
        [KV_KEY, value, now],
        nativeDB,
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[admin/settings] POST failed:", err)
    return NextResponse.json(
      {
        error: err.message ?? "Save failed",
        debug: { message: err.message ?? String(err), stack: err.stack?.split("\n").slice(0, 3) },
      },
      { status: 500 },
    )
  }
}
