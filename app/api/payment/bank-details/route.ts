// app/api/payment/bank-details/route.ts
// Admin-only endpoint for reading/writing bank details.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

// Merges Next.js required context shape with Cloudflare Pages env binding.
// On Vercel: context.env is undefined → d1Query falls back to HTTP API.
// On CF Pages: context.env.DB is the native D1 binding → fast, no HTTP.
type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const KV_KEY = "settings:bankDetails"

async function ensureKvTable(nativeDB?: unknown) {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    )`,
    [],
    nativeDB,
  )
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

  try {
    await ensureKvTable(nativeDB)
    const rows = await d1Query<{ value: string }>(
      `SELECT value FROM kv_store WHERE key = ? LIMIT 1`,
      [KV_KEY],
      nativeDB,
    )
    const row = rows?.results?.[0]
    if (!row) return NextResponse.json({ bankDetails: null })
    return NextResponse.json({ bankDetails: JSON.parse(row.value) })
  } catch (err: any) {
    console.error("[GET /api/payment/bank-details]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { bankName, accountNumber, accountName, bankCode } = await req.json()
    if (!bankName || !accountNumber || !accountName)
      return NextResponse.json(
        { error: "bankName, accountNumber, and accountName are required" },
        { status: 400 },
      )

    await ensureKvTable(nativeDB)
    const now   = new Date().toISOString()
    const value = JSON.stringify({
      bank_name:      bankName.trim(),
      account_number: accountNumber.trim(),
      account_name:   accountName.trim(),
      bank_code:      bankCode?.trim() ?? "",
      updatedAt:      now,
    })

    const existing = await d1Query(
      `SELECT key FROM kv_store WHERE key = ? LIMIT 1`,
      [KV_KEY],
      nativeDB,
    )
    if (existing?.results?.[0]) {
      await d1Query(
        `UPDATE kv_store SET value = ?, updated_at = ? WHERE key = ?`,
        [value, now, KV_KEY],
        nativeDB,
      )
    } else {
      await d1Query(
        `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)`,
        [KV_KEY, value, now],
        nativeDB,
      )
    }

    return NextResponse.json({ success: true, message: "Bank details saved successfully" })
  } catch (err: any) {
    console.error("[POST /api/payment/bank-details]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
