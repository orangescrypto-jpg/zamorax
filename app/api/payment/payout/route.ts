// app/api/payment/payout/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { requireAdmin } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  // ── Auth guard: admin only ────────────────────────────────────
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  try {
    const { sellerId, amountKobo, bankName, accountNumber, accountName, reference, orderId } = await req.json()
    if (!sellerId || !amountKobo || !reference)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    // Credit seller wallet
    const wallet = await AdminService.getDoc("seller_wallets", sellerId) as Record<string, unknown> | null
    const bal    = Number(wallet?.balance ?? 0)
    const earned = Number(wallet?.total_earned ?? wallet?.totalEarned ?? 0)
    const pending = Number(wallet?.pending_balance ?? wallet?.pendingBalance ?? 0)

    await AdminService.setDoc("seller_wallets", sellerId, {
      balance:         bal + amountKobo,
      total_earned:    earned + amountKobo,
      pending_balance: Math.max(0, pending - amountKobo),
      updated_at:      new Date().toISOString(),
    }, { merge: true })

    // Log wallet transaction
    await AdminService.addDoc("wallet_transactions", {
      user_id:     sellerId,
      type:        "credit",
      amount:      amountKobo,
      description: `Escrow released — ₦${(amountKobo / 100).toLocaleString("en-NG")} credited`,
      reference,
      order_id:    orderId ?? null,
      status:      "completed",
    })

    // Queue payout request
    await AdminService.addDoc("payout_requests", {
      seller_id:      sellerId,
      amount:         amountKobo,
      bank_name:      bankName ?? null,
      account_number: accountNumber ?? null,
      account_name:   accountName ?? null,
      reference,
      provider:       "manual",
      status:         "pending",
    })

    // Notify seller
    await AdminService.addDoc("notifications", {
      user_id: sellerId,
      type:    "system",
      title:   "💸 Payout Queued",
      body:    `₦${(amountKobo / 100).toLocaleString("en-NG")} has been credited to your wallet and queued for payout.`,
      link:    "/dashboard/seller/wallet",
      is_read: false,
    })

    return NextResponse.json({ success: true, walletCredited: true, reference })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
