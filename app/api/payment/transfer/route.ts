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

    // FIX: idempotency guard. Reference is deterministic (`WD-${withdrawalId}`
    // from the caller), so if this exact transfer was already initiated —
    // e.g. the admin's browser crashed reading a previous response (the
    // "Unexpected end of JSON input" class of bug) and they clicked Approve
    // again — check Paystack first instead of blindly firing a second real
    // bank transfer for the same withdrawal.
    const verifyRes = await fetch(
      `https://api.paystack.co/transfer/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    )
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json()
      const existingStatus = verifyData?.data?.status as string | undefined
      if (verifyData.status && existingStatus && existingStatus !== "failed" && existingStatus !== "reversed") {
        // A transfer with this reference already exists and isn't in a
        // failed/reversed state — don't send another one. Return the
        // existing result so the caller can proceed as if this were the
        // original successful call.
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          transferCode: verifyData.data.transfer_code,
          transferStatus: existingStatus,
          reference,
        })
      }
      // If existingStatus is "failed" or "reversed", fall through and retry
      // the transfer below — that's a legitimate reason to send it again.
    }

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
    if (!recipientRes.ok || !recipientData.status || !recipientData.data?.recipient_code) {
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

    const transferStatus = transferData.data?.status as string | undefined

    // FIX: Paystack can return status "otp" when OTP-based transfer approval
    // is enabled on the account (a common fraud-prevention setting) — this
    // means the transfer is NOT complete yet, it's waiting on a manual OTP
    // finalization step via /transfer/finalize_transfer. The caller
    // previously treated ANY non-error response as success:true, so the
    // admin page immediately marked the withdrawal "completed" and emailed
    // the seller "paid" even though no money had actually moved. Surface
    // this distinctly so the admin page can show a real "needs OTP" state
    // instead of a false completion.
    if (transferStatus === "otp") {
      return NextResponse.json({
        success: false,
        requiresOtp: true,
        transferCode: transferData.data.transfer_code,
        error: "This transfer requires OTP approval in your Paystack dashboard before it completes. It has NOT been marked as paid.",
        reference,
      }, { status: 202 })
    }

    return NextResponse.json({
      success: true,
      transferCode: transferData.data?.transfer_code,
      transferStatus: transferStatus ?? "success", // "success" | "pending"
      reference,
    })
  } catch (err: any) {
    console.error("[payment/transfer] Unexpected error:", err)
    return NextResponse.json({ success: false, error: err.message || "Transfer failed" }, { status: 500 })
  }
}
