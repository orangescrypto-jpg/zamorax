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

    if (provider === "flutterwave") {
      // Flutterwave doesn't have a separate "create recipient" step for
      // plain transfers — bank_code + account_number are passed directly
      // on each transfer call. This creates a Flutterwave SUBACCOUNT
      // instead, which is what's needed for escrow split payments (a
      // seller's subaccount id gets attached to their order payments so
      // escrow releases split straight to their bank). For a seller who
      // only ever gets paid via manual wallet withdrawal (no escrow
      // split), this is optional — the recipientCode returned here is
      // still safe to store either way.
      const secretKey = process.env.FLW_SECRET_KEY
      if (!secretKey) return NextResponse.json({ error: "FLW_SECRET_KEY not configured" }, { status: 500 })

      const res = await fetch("https://api.flutterwave.com/v3/subaccounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_bank:   bankCode,
          account_number: accountNumber,
          business_name:  accountName,
          split_type:     "percentage",
          // Default split kept at 0 — the actual per-transaction commission
          // split is controlled per-order at checkout, not fixed here.
          // Sellers with no override keep 100% of what a subaccount split
          // sends them; the platform's cut is taken by NOT including a
          // subaccount for the commission portion, same pattern as Paystack.
          split_value: 0,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.status !== "success") {
        return NextResponse.json({ error: data.message || "Could not create Flutterwave subaccount" }, { status: 400 })
      }

      return NextResponse.json({ recipientCode: String(data.data.subaccount_id ?? data.data.id) })
    }

    return NextResponse.json({ recipientCode: `MANUAL_${accountNumber}_${Date.now()}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Create recipient failed" }, { status: 500 })
  }
}
