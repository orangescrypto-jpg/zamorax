// src/services/notifyEscrowReleased.ts
// Server-only helper — computes the fee breakdown for the "Escrow Released"
// email and sends it. Shared by every path that can release escrow to a
// seller (manual buyer confirmation, auto-release cron, dispute resolution)
// so the email logic — and its fee math — lives in exactly one place.
//
// ⚠️ Do not import this from a "use client" component: it calls out to
// process.env.INTERNAL_EMAIL_SECRET, which must never reach the browser.

import { AdminService } from "@/src/services/admin"
import { getPlatformSettings } from "@/src/services/platformSettings"
import { Emails } from "@/src/services/email"

function ngn(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export async function notifyEscrowReleased(orderRow: Record<string, unknown>): Promise<void> {
  try {
    const sellerId  = String(orderRow.seller_id  ?? orderRow.sellerId  ?? "")
    const itemTitle = String(orderRow.item_title  ?? orderRow.itemTitle  ?? "your item")
    const orderId   = String(orderRow.id ?? "")
    const totalKobo = Number(orderRow.total_amount ?? orderRow.totalAmount ?? 0)
    const feeKobo   = Number(orderRow.platform_fee ?? orderRow.platformFee ?? 0)
    const payout    = Number(orderRow.seller_payout ?? orderRow.sellerPayout ?? Math.max(0, totalKobo - feeKobo))
    if (!sellerId) return

    const seller = await AdminService.getDoc("users", sellerId) as Record<string, unknown> | null
    const sellerEmail = String(seller?.email ?? "")
    if (!sellerEmail) return

    // orders.platform_fee is stored as a single combined figure. Split it
    // proportionally using the *current* commission/insurance rates so the
    // receipt still reads sensibly even though the exact historical split
    // per order isn't persisted.
    const settings = await getPlatformSettings()
    const commissionPct  = settings.commissionSale ?? 0
    const arbitrationPct = settings.insuranceRate ?? 0
    const combinedPct    = commissionPct + arbitrationPct
    const commissionAmt  = combinedPct > 0 ? Math.round((feeKobo * commissionPct)  / combinedPct) : feeKobo
    const arbitrationAmt = Math.max(0, feeKobo - commissionAmt)

    await Emails.escrowReleased(sellerEmail, {
      sellerName:     String(seller?.fullName ?? seller?.full_name ?? orderRow.seller_name ?? "there"),
      itemTitle,
      orderId,
      grossAmount:    ngn(totalKobo),
      commissionAmt:  ngn(commissionAmt),
      commissionPct:  `${commissionPct}%`,
      arbitrationAmt: ngn(arbitrationAmt),
      arbitrationPct: `${arbitrationPct}%`,
      // Withdrawal fee is only deducted when the seller actually withdraws
      // from their wallet, not at escrow release — funds just landed in
      // the wallet balance at this point.
      withdrawalFee:  ngn(0),
      netPayout:      ngn(payout),
    })
  } catch (err) {
    // Never let email failure break a release flow.
    console.error("[notifyEscrowReleased] failed (non-fatal):", err)
  }
}
