// app/api/payment/bank-details/route.ts
// Admin-only endpoint for reading/writing bank details.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"

async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_D1_DATABASE_ID}/query`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.CF_API_TOKEN}`,
    },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  })
  const json = await res.json() as any
  if (!json.success) throw new Error(`D1 error: ${json.errors?.[0]?.message ?? "unknown"}`)
  return (json.result?.[0]?.results ?? []) as T[]
}

async function ensureKvTable() {
  await d1Query(
    `CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    )`
  )
}

export async function GET() {
  try {
    await ensureKvTable()
    const rows = await d1Query<{ value: string }>(
      `SELECT value FROM kv_store WHERE key = ? LIMIT 1`,
      ["settings:bankDetails"]
    )
    if (!rows[0]) return NextResponse.json({ bankDetails: null })
    return NextResponse.json({ bankDetails: JSON.parse(rows[0].value) })
  } catch (err: any) {
    console.error("[GET /api/payment/bank-details]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  try {
    const { bankName, accountNumber, accountName, bankCode } = await req.json()
    if (!bankName || !accountNumber || !accountName)
      return NextResponse.json(
        { error: "bankName, accountNumber, and accountName are required" },
        { status: 400 }
      )

    await ensureKvTable()
    const now   = new Date().toISOString()
    const value = JSON.stringify({
      bank_name:      bankName.trim(),
      account_number: accountNumber.trim(),
      account_name:   accountName.trim(),
      bank_code:      bankCode?.trim() ?? "",
      updatedAt:      now,
    })
    const key = "settings:bankDetails"

    const existing = await d1Query(`SELECT key FROM kv_store WHERE key = ? LIMIT 1`, [key])
    if (existing[0]) {
      await d1Query(`UPDATE kv_store SET value = ?, updated_at = ? WHERE key = ?`, [value, now, key])
    } else {
      await d1Query(`INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)`, [key, value, now])
    }

    return NextResponse.json({ success: true, message: "Bank details saved successfully" })
  } catch (err: any) {
    console.error("[POST /api/payment/bank-details]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
