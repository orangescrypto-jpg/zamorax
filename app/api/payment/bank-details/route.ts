// app/api/payment/bank-details/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { createClient } from "@supabase/supabase-js"

async function isAuthorizedAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnon) return false
    const client = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error } = await client.auth.getUser(token)
    if (error || !user?.id) return false
    // Verify role in D1
    const row = await AdminService.getDoc("users", user.id) as any
    return row?.role === "admin"
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const row = await AdminService.getDoc("settings", "bankDetails")
    return NextResponse.json({ bankDetails: row ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorizedAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const { bankName, accountNumber, accountName, bankCode } = await req.json()
    if (!bankName || !accountNumber || !accountName)
      return NextResponse.json({ error: "bankName, accountNumber, and accountName are required" }, { status: 400 })
    await AdminService.setDoc("settings", "bankDetails", {
      bank_name:      bankName.trim(),
      account_number: accountNumber.trim(),
      account_name:   accountName.trim(),
      bank_code:      bankCode?.trim() ?? "",
    }, { merge: true })
    return NextResponse.json({ success: true, message: "Bank details saved successfully" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
