// app/api/seller/withdraw/route.ts
// Seller-initiated withdrawal request.
// Validates balance, deducts from wallet, writes to `withdrawals` collection
// (which the admin withdrawals page reads and approves).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { requireAuth } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const sellerId = auth.uid

  try {
    const { amountKobo, bankName, accountNumber, accountName } = await req.json()

    if (!amountKobo || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (amountKobo < 100000) {
      return NextResponse.json({ error: "Minimum withdrawal is ₦1,000" }, { status: 400 })
    }

    // Get current wallet balance
    const wallet = await AdminService.getDoc("seller_wallets", sellerId) as Record<string, unknown> | null
    const currentBalance = Number(wallet?.balance ?? 0)

    if (amountKobo > currentBalance) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 })
    }

    // Get seller info for admin display
    const sellerDoc = await AdminService.getDoc("users", sellerId) as Record<string, unknown> | null
    const sellerName  = String(sellerDoc?.displayName ?? sellerDoc?.display_name ?? sellerDoc?.name ?? "Seller")
    const sellerEmail = String(sellerDoc?.email ?? "")

    // Get withdrawal fee from config
    const feeConfig = await AdminService.getDoc("config", "feeSettings") as Record<string, unknown> | null
    const withdrawalFeeKobo = Number(feeConfig?.withdrawalFee ?? feeConfig?.withdrawal_fee ?? 0)

    const netAmountKobo = Math.max(0, amountKobo - withdrawalFeeKobo)

    // Deduct from wallet immediately (held pending admin payment)
    await AdminService.setDoc("seller_wallets", sellerId, {
      balance:    currentBalance - amountKobo,
      updated_at: new Date().toISOString(),
    }, { merge: true })

    // Write to `withdrawals` collection (admin reads this)
    const withdrawalDoc = await AdminService.addDoc("withdrawals", {
      seller_id:      sellerId,
      seller_name:    sellerName,
      seller_email:   sellerEmail,
      amount:         amountKobo,
      fee:            withdrawalFeeKobo,
      net_amount:     netAmountKobo,
      bank_name:      bankName,
      account_number: accountNumber,
      account_name:   accountName,
      status:         "pending",
    })

    // Log wallet transaction
    await AdminService.addDoc("wallet_transactions", {
      user_id:     sellerId,
      type:        "payout",
      amount:      amountKobo,
      description: `Withdrawal request — ₦${(amountKobo / 100).toLocaleString("en-NG")} to ${bankName}`,
      reference:   withdrawalDoc.id,
      status:      "pending",
    })

    // Notify seller
    await AdminService.addDoc("notifications", {
      user_id: sellerId,
      type:    "system",
      title:   "💸 Withdrawal Requested",
      body:    `Your withdrawal of ₦${(amountKobo / 100).toLocaleString("en-NG")} is being processed. We'll notify you when it's paid.`,
      link:    "/dashboard/seller/wallet",
      is_read: false,
    })

    return NextResponse.json({ success: true, withdrawalId: withdrawalDoc.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
