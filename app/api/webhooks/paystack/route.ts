// app/api/webhooks/paystack/route.ts
//
// WHY THIS EXISTS:
// POST /api/payment/transfer initiates a Paystack Transfer and returns
// whatever status Paystack gives back at that instant — "success",
// "pending", or "otp". The admin withdrawals page (handleApprovePaystack)
// marks the withdrawal "completed" the moment that call returns
// success:true, with no distinction between "success" (money has actually
// moved) and "pending" (Paystack accepted the transfer but the receiving
// bank hasn't confirmed it yet — it can still fail or reverse afterward).
// There was no webhook at all, so a transfer that started "pending" and
// later failed or reversed had no way to ever correct the withdrawal's
// status — the seller would be shown as "paid" indefinitely even if the
// money bounced back to the platform's Paystack balance.
//
// This handler listens for Paystack's transfer.success, transfer.failed,
// and transfer.reversed events and reconciles the matching withdrawal row
// against what Paystack says actually happened — same idea as
// /api/webhooks/zamoraxlogic, just for transfers instead of shipments.
//
// SETUP REQUIRED (do this once you're on a live key):
//   1. Paystack dashboard → Settings → API Keys & Webhooks
//   2. Webhook URL: https://zamorax.com/api/webhooks/paystack
//   3. No separate webhook secret to configure — Paystack signs webhooks
//      using your PAYSTACK_SECRET_KEY (the same one already in your env),
//      so nothing new needs to be added there.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { AdminService } from "@/src/services/admin"
import { Emails } from "@/src/services/email"

function verifyPaystackSignature(rawBody: string, signature: string): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey || !signature) return false
  try {
    const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex")
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get("x-paystack-signature") ?? ""

    if (!verifyPaystackSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const { event, data } = JSON.parse(rawBody)

    // Only transfer events are relevant here. Payment/charge events are
    // handled separately by the existing verify-on-return flow
    // (create-verified-paystack / activate-paystack / create-pending-orders) —
    // this webhook exists specifically to close the transfer-status gap.
    if (!event?.startsWith("transfer.")) {
      return NextResponse.json({ received: true })
    }

    const reference = String(data?.reference ?? "")
    const transferCode = String(data?.transfer_code ?? "")
    if (!reference && !transferCode) {
      return NextResponse.json({ received: true })
    }

    // reference is set to `WD-${withdrawal.id}` when the transfer is
    // initiated (see admin/withdrawals/page.tsx handleApprovePaystack) —
    // that's the reliable lookup key. transfer_reference (the code Paystack
    // assigns) is stored too, kept as a fallback in case reference is ever
    // missing from a payload.
    const withdrawalId = reference.startsWith("WD-") ? reference.slice(3) : ""
    let withdrawal = withdrawalId
      ? (await AdminService.getDoc("withdrawals", withdrawalId) as Record<string, unknown> | null)
      : null

    if (!withdrawal && transferCode) {
      const all = await AdminService.getCollection("withdrawals") as Record<string, unknown>[]
      withdrawal = all.find(w => (w.transferReference ?? (w as any).transfer_reference) === transferCode) ?? null
    }

    if (!withdrawal) return NextResponse.json({ received: true })

    const wId = String(withdrawal.id)
    const now = new Date().toISOString()

    if (event === "transfer.success") {
      // Idempotent — a withdrawal already marked completed by the synchronous
      // path in handleApprovePaystack doesn't need re-processing, and this
      // event can legitimately arrive after that if the transfer started
      // as "pending" and only resolved to "success" afterward.
      if (String(withdrawal.status) !== "completed") {
        await AdminService.updateDoc("withdrawals", wId, {
          status: "completed",
          transferReference: transferCode || withdrawal.transferReference,
          paidAt: now,
          updatedAt: now,
        })

        const sellerEmail = String(withdrawal.sellerEmail ?? "")
        if (sellerEmail) {
          Emails.withdrawalPaid(sellerEmail, {
            sellerName: String(withdrawal.sellerName ?? "there"),
            amount: `₦${(Number(withdrawal.netAmount ?? withdrawal.amount ?? 0) / 100).toLocaleString("en-NG")}`,
            bankName: String(withdrawal.bankName ?? ""),
            accountNumber: String(withdrawal.accountNumber ?? ""),
            reference: transferCode || reference,
          }).catch(() => { /* fire-and-forget — already logged inside sendEmail */ })
        }

        await AdminService.addDoc("notifications", {
          user_id: withdrawal.userId ?? (withdrawal as any).user_id,
          type: "system",
          title: "💸 Withdrawal Paid",
          body: `Your withdrawal of ₦${(Number(withdrawal.netAmount ?? withdrawal.amount ?? 0) / 100).toLocaleString("en-NG")} has been paid to your bank account.`,
          link: "/dashboard/seller/earnings",
          is_read: false,
        })
      }
    }

    if (event === "transfer.failed" || event === "transfer.reversed") {
      // This is the case the synchronous approve flow could never catch —
      // a transfer that looked fine when initiated (status "pending") but
      // failed or bounced back afterward. Reopen the withdrawal instead of
      // leaving it silently stuck on "completed" with money that never
      // actually reached the seller — and credit their wallet back since
      // /api/seller/withdraw already deducted it up front.
      // Use "rejected" here, not a new "failed" status — the admin
      // withdrawals page only has four tabs (pending/approved/completed/
      // rejected) and a status the UI doesn't recognize would make this
      // withdrawal invisible in every tab instead of showing up anywhere.
      if (String(withdrawal.status) !== "rejected") {
        await AdminService.updateDoc("withdrawals", wId, {
          status: "rejected",
          rejectionReason: `Paystack ${event === "transfer.failed" ? "transfer failed" : "transfer reversed"}: ${data?.failure_reason ?? "no reason given"}`,
          rejectedAt: now,
          updatedAt: now,
        })

        const userId = String(withdrawal.userId ?? (withdrawal as any).user_id ?? "")
        if (userId) {
          const wallet = await AdminService.getDoc("seller_wallets", userId) as Record<string, unknown> | null
          const bal = Number(wallet?.balance ?? 0)
          const refundAmount = Number(withdrawal.amount ?? 0)
          await AdminService.setDoc("seller_wallets", userId, {
            balance: bal + refundAmount,
            updated_at: now,
          }, { merge: true })

          await AdminService.addDoc("wallet_transactions", {
            user_id: userId,
            type: "refund",
            amount: refundAmount,
            description: `Withdrawal reversed — funds returned to wallet (${event})`,
            reference: transferCode || reference,
            status: "completed",
          })

          await AdminService.addDoc("notifications", {
            user_id: userId,
            type: "system",
            title: "⚠️ Withdrawal Failed",
            body: `Your withdrawal could not be completed and ₦${(refundAmount / 100).toLocaleString("en-NG")} has been returned to your wallet. Please check your bank details and try again.`,
            link: "/dashboard/seller/earnings",
            is_read: false,
          })
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("[webhooks/paystack] error:", err)
    // Still return 200 — Paystack retries on non-2xx, and a webhook that's
    // failing due to a bug shouldn't hammer the endpoint indefinitely.
    // The error is logged for investigation either way.
    return NextResponse.json({ received: true })
  }
}
