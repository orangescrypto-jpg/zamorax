// app/api/payment/transfer/route.ts
// Sends an actual bank transfer via Paystack Transfers API. Used only when
// platform settings have payoutMethod = "paystack". This is what
// automatically pays a seller the moment admin approves a withdrawal —
// no manual bank transfer step needed.
//
// Requires: PAYSTACK_SECRET_KEY, and that Paystack live transfers are
// unlocked on the account (business KYC completed). Test-mode transfers
// work without KYC but only send to Paystack's test recipients.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  try {
    const {
      amountKobo, accountName, accountNumber, bankCode, reference, reason,
    } = await req.json()

    if (!amountKobo || !accountNumber || !bankCode || !reference) {
      return NextResponse.json({ error: "Missing required transfer fields" }, { status: 400 })
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) return NextResponse.json({ error: "PAYSTACK_SECRET_KEY not configured" }, { status: 500 })

    // Step 1: create (or reuse) a transfer recipient.
    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "nuban", name: accountName, account_number: accountNumber,
        bank_code: bankCode, currency: "NGN",
      }),
    })
    const recipientData = await recipientRes.json()
    if (!recipientRes.ok || !recipientData.status) {
      return NextResponse.json(
        { success: false, error: recipientData.message || "Could not create transfer recipient", reference },
        { status: 400 },
      )
    }
    const recipientCode = recipientData.data.recipient_code

    // Step 2: initiate the transfer itself.
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balance",
        amount: amountKobo,
        recipient: recipientCode,
        reference,
        reason: reason || "Zamorax seller withdrawal",
      }),
    })
    const transferData = await transferRes.json()

    if (!transferRes.ok || !transferData.status) {
      // Insufficient platform balance is the most common real-world failure —
      // surface it clearly so admin knows to fund the Paystack balance,
      // rather than a generic "transfer failed".
      const message = transferData.message || "Transfer failed"
      return NextResponse.json({ success: false, error: message, reference }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      transferCode: transferData.data.transfer_code,
      transferStatus: transferData.data.status, // "success" | "pending" | "otp" (rare, only if OTP transfers enabled)
      reference,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Transfer failed" }, { status: 500 })
  }
}
