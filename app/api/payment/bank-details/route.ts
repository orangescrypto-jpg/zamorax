// app/api/payment/bank-details/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"

export async function GET() {
  try {
    const row = await AdminService.getDoc("settings", "bankDetails")
    return NextResponse.json({ bankDetails: row ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
