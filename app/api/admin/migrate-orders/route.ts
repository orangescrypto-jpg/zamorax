// app/api/admin/migrate-orders/route.ts
// One-time migration: adds missing columns to the D1 `orders` table.
// Call POST /api/admin/migrate-orders (admin only) once after deploy.
// Safe to call multiple times — uses ALTER TABLE … ADD COLUMN IF NOT EXISTS.

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

async function getSessionUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll() }, setAll() {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Columns to add — each is [column_name, sqlite_type_with_default]
const MIGRATIONS: [string, string][] = [
  ["item_image",        "TEXT"],
  ["buyer_name",        "TEXT"],
  ["seller_name",       "TEXT"],
  ["seller_store_name", "TEXT"],
  ["delivery_street",   "TEXT"],
  ["delivery_city",     "TEXT"],
  ["delivery_state",    "TEXT"],
  ["delivery_lga",      "TEXT"],
  ["delivery_method",   "TEXT"],
  ["seller_state",      "TEXT"],
  ["buyer_state",       "TEXT"],
  ["payment_reference", "TEXT"],
  ["payment_provider",  "TEXT"],
  ["buyer_reviewed",    "INTEGER DEFAULT 0"],
  // Seller shipping — optional tracking number provided when marking an order shipped
  ["tracking_number",   "TEXT"],
]

export async function POST(req: NextRequest) {
  // Admin only
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const role = (user.user_metadata?.role as string | undefined) ?? ""
  if (role !== "admin" && role !== "moderator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const results: { column: string; status: string }[] = []

  for (const [col, typeDef] of MIGRATIONS) {
    try {
      // SQLite supports IF NOT EXISTS in ALTER TABLE ADD COLUMN
      await d1Query(
        `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col} ${typeDef}`,
        [],
      )
      results.push({ column: col, status: "ok" })
    } catch (err: any) {
      // "duplicate column name" is expected if column already exists
      // and IF NOT EXISTS is not supported in older SQLite
      const msg: string = err?.message ?? ""
      if (msg.toLowerCase().includes("duplicate column")) {
        results.push({ column: col, status: "already_exists" })
      } else {
        results.push({ column: col, status: `error: ${msg}` })
      }
    }
  }

  return NextResponse.json({ success: true, results })
}
