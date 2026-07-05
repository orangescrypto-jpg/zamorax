// app/api/payment/notify-withdrawal-paid/route.ts
// Called by the admin withdrawals page (client component) right after a
// withdrawal is marked paid (Paystack auto-transfer or manual mark-paid).
// Email sending needs the Resend key, which only exists server-side, so
// this small route exists purely to let that client component trigger the
// seller-facing "your withdrawal was paid" email with the transfer
// reference and proof link admin just attached.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"
import { Emails } from "@/src/services/email"

export async function POST(req: NextRequest) {
  const auth = await requireModerator(req)
  if (!auth.ok) return auth.error

  try {
    const { withdrawalId } = await req.json()
    if (!withdrawalId) return NextResponse.json({ error: "withdrawalId required" }, { status: 400 })

    const withdrawal = await AdminService.getDoc("withdrawals", withdrawalId) as Record<string, unknown> | null
    if (!withdrawal) return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 })

    const sellerId    = String(withdrawal.userId ?? withdrawal.user_id ?? "")
    const sellerEmail = String(withdrawal.sellerEmail ?? withdrawal.seller_email ?? "")
    const sellerName  = String(withdrawal.sellerName ?? withdrawal.seller_name ?? "there")

    let email = sellerEmail
    if (!email && sellerId) {
      const seller = await AdminService.getDoc("users", sellerId) as Record<string, unknown> | null
      email = String(seller?.email ?? "")
    }
    if (!email) return NextResponse.json({ error: "No email on file for this seller" }, { status: 404 })

    await Emails.withdrawalPaid(email, {
      sellerName,
      amount:        `₦${(Number(withdrawal.amount ?? 0) / 100).toLocaleString("en-NG")}`,
      bankName:      String(withdrawal.bankName ?? withdrawal.bank_name ?? ""),
      accountNumber: String(withdrawal.accountNumber ?? withdrawal.account_number ?? ""),
      reference:     String(withdrawal.transferReference ?? withdrawal.transfer_reference ?? ""),
      proofUrl:      (withdrawal.proofUrl ?? withdrawal.proof_url ?? null) as string | null,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[POST /api/payment/notify-withdrawal-paid]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
