// app/api/admin/backfill-wallets/route.ts
// ONE-TIME: Credits seller wallets for completed orders that were never credited.
// Admin-only. Call once, then delete this route.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { requireAdmin } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const allOrders = await AdminService.getCollection("orders") as Record<string, unknown>[]
  const completed = allOrders.filter(o => String(o.status) === "completed")

  const results: { orderId: string; status: string; payout?: number }[] = []

  for (const order of completed) {
    const orderId  = String(order.id ?? "")
    const sellerId = String(order.seller_id ?? order.sellerId ?? "")
    const grossKobo = Number(order.total_amount ?? order.totalAmount ?? 0)
    const commKobo  = Number(order.platform_fee ?? order.platformFee ?? 0)
    const arbKobo   = Number(order.arbitration_fee ?? order.arbitrationFee ?? Math.round(grossKobo * 0.005))
    const wdKobo    = Number(order.withdrawal_fee ?? order.withdrawalFee ?? 0)
    const payout    = Number(order.seller_payout ?? order.sellerPayout ?? (grossKobo - commKobo - arbKobo - wdKobo))

    if (!sellerId || payout <= 0) {
      results.push({ orderId, status: "skipped" })
      continue
    }

    // Check if already credited for this order
    const existing = await AdminService.getCollection("wallet_transactions", [
      { field: "order_id", op: "==", value: orderId } as any,
      { field: "type",     op: "==", value: "credit" } as any,
    ]) as Record<string, unknown>[]

    if (existing.length > 0) {
      results.push({ orderId, status: "already_credited" })
      continue
    }

    try {
      const wallet  = await AdminService.getDoc("seller_wallets", sellerId) as Record<string, unknown> | null
      const bal     = Number(wallet?.balance ?? 0)
      const earned  = Number(wallet?.total_earned ?? wallet?.totalEarned ?? 0)

      await AdminService.setDoc("seller_wallets", sellerId, {
        balance:      bal + payout,
        total_earned: earned + payout,
        updated_at:   new Date().toISOString(),
      }, { merge: true })

      await AdminService.addDoc("wallet_transactions", {
        user_id:     sellerId,
        type:        "credit",
        amount:      payout,
        description: `Backfill — order #${orderId.slice(0, 8).toUpperCase()}`,
        order_id:    orderId,
        status:      "completed",
      })

      results.push({ orderId, status: "credited", payout })
    } catch (err: any) {
      results.push({ orderId, status: `error: ${err.message}` })
    }
  }

  return NextResponse.json({ success: true, results })
}
