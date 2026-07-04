// app/api/payment/resolve/route.ts
// Resolves a bank account number to its registered account name via Paystack.
// Used before creating a transfer recipient so admin/seller can confirm the
// name matches what the seller entered (catches typos / wrong account numbers).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const { provider, accountNumber, bankCode } = await req.json()

    if (!accountNumber || !bankCode) {
      return NextResponse.json({ error: "accountNumber and bankCode are required" }, { status: 400 })
    }

    if (provider === "paystack") {
      const secretKey = process.env.PAYSTACK_SECRET_KEY
      if (!secretKey) return NextResponse.json({ error: "PAYSTACK_SECRET_KEY not configured" }, { status: 500 })

      const res = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
        { headers: { Authorization: `Bearer ${secretKey}` } },
      )
      const data = await res.json()
      if (!res.ok || !data.status) {
        return NextResponse.json({ error: data.message || "Could not resolve account" }, { status: 400 })
      }

      return NextResponse.json({
        accountName: data.data.account_name,
        accountNumber: data.data.account_number,
      })
    }

    // Manual/unsupported providers — no third-party verification available.
    return NextResponse.json({ accountName: null, accountNumber, unverified: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Resolve failed" }, { status: 500 })
  }
}
