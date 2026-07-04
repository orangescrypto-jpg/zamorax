// app/api/payment/recipient/route.ts
// Creates a Paystack "transfer recipient" — a saved bank destination that
// Paystack requires before you can send it money. One recipient per seller
// bank account; recipient_code is cached on the withdrawal/seller record so
// repeat payouts to the same account skip this step.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  try {
    const { provider, accountName, accountNumber, bankCode } = await req.json()

    if (!accountName || !accountNumber || !bankCode) {
      return NextResponse.json({ error: "accountName, accountNumber, and bankCode are required" }, { status: 400 })
    }

    if (provider === "paystack") {
      const secretKey = process.env.PAYSTACK_SECRET_KEY
      if (!secretKey) return NextResponse.json({ error: "PAYSTACK_SECRET_KEY not configured" }, { status: 500 })

      const res = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: accountName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN",
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.status) {
        return NextResponse.json({ error: data.message || "Could not create recipient" }, { status: 400 })
      }

      return NextResponse.json({ recipientCode: data.data.recipient_code })
    }

    return NextResponse.json({ recipientCode: `MANUAL_${accountNumber}_${Date.now()}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Create recipient failed" }, { status: 500 })
  }
}
