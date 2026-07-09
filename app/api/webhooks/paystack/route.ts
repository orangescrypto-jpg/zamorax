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
// ALSO handles charge.success as a server-side safety net for order
// activation. Orders are now created directly at escrow_held once
// create-verified-paystack/create-pending-orders verify payment
// server-side, so in the current flow there's no window where a real
// order sits unpaid. But /api/orders/activate-paystack — which flips a
// pre-existing "pending" order to escrow_held — only ever runs when the
// buyer's own orders page happens to load after the Paystack redirect. If
// that never happens (closed tab, crashed browser, network drop) any
// order that IS still sitting at "pending" for a paystack reference would
// stay stuck forever with no other trigger to activate it. This handler
// is that other trigger — Paystack calls it directly and independently of
// anything the buyer's browser does, so activation isn't solely dependent
// on the buyer returning to the app.
//
// SETUP REQUIRED (do this once you're on a live key):
//   1. Paystack dashboard → Settings → API Keys & Webhooks
//   2. Webhook URL: https://zamorax.com/api/webhooks/paystack
//   3. No separate webhook secret to configure — Paystack signs webhooks
//      using your PAYSTACK_SECRET_KEY (the same one already in your env),
//      so nothing new needs to be added there.
//   4. In the Paystack dashboard, make sure "charge.success" is enabled
//      as a webhook event (transfer.* events must already be enabled from
//      the original setup — charge.success is an additional one to add).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { AdminService } from "@/src/services/admin"
import { Emails } from "@/src/services/email"
import { ChatService } from "@/src/services/chat"

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

// Shared with /api/orders/activate-paystack's intent — this mirrors that
// route's side effects (status flip, notifications, chat, emails, referral
// bonus) so an order activated by the webhook behaves identically to one
// activated by the buyer's own page load. Idempotent: safe to run even if
// activate-paystack already handled this same order moments earlier.
async function activateOrderFromWebhook(order: Record<string, unknown>, reference: string) {
  const orderId = String(order.id)
  if (String(order.status ?? "") === "escrow_held" || String(order.status ?? "") === "completed") {
    return // already active (or further along) — nothing to do
  }
  if (String(order.paymentProvider ?? (order as any).payment_provider ?? "") !== "paystack") {
    return
  }

  const now = new Date().toISOString()
  await AdminService.updateDoc("orders", orderId, {
    status: "escrow_held",
    escrowStatus: "held",
    escrowHeldAt: now,
  })

  const buyerId  = String(order.buyerId ?? (order as any).buyer_id ?? "")
  const sellerId = String(order.sellerId ?? (order as any).seller_id ?? "")
  const listingId = String(order.listingId ?? (order as any).listing_id ?? "")
  const itemTitle = String(order.itemTitle ?? (order as any).item_title ?? "your item")
  const totalAmount = Number(order.totalAmount ?? (order as any).total_amount ?? 0)

  const buyer = buyerId ? (await AdminService.getDoc("users", buyerId) as Record<string, unknown> | null) : null

  if (buyerId) {
    await AdminService.addDoc("notifications", {
      user_id: buyerId,
      type: "system",
      title: "✅ Payment Confirmed!",
      body: "Payment confirmed. Escrow is now active — the seller will be notified to ship.",
      link: `/dashboard/buyer/orders/${orderId}`,
      is_read: false,
    })
  }

  if (sellerId && listingId && sellerId !== buyerId) {
    try {
      const chat = await ChatService.getOrCreateChat({
        listingId,
        listingTitle: itemTitle,
        listingImage: (order.listingImage ?? (order as any).listing_image ?? null) as string | null,
        buyerId,
        buyerName: String(buyer?.fullName ?? (buyer as any)?.full_name ?? "Buyer"),
        sellerId,
        sellerName: String(order.sellerName ?? (order as any).seller_name ?? "Seller"),
      })
      await ChatService.sendMessage(
        chat.id, "system",
        `Order confirmed — escrow is now active for "${itemTitle}". You can chat here to coordinate delivery.`,
      )
    } catch (err) {
      console.error("auto chat creation failed (webhooks/paystack charge.success):", err)
    }
  }

  const buyerEmail = String(buyer?.email ?? "")
  if (buyerEmail) {
    Emails.orderConfirmed(buyerEmail, {
      buyerName: String(buyer?.fullName ?? (buyer as any)?.full_name ?? "there"),
      itemTitle, orderId,
      totalAmount: `₦${(totalAmount / 100).toLocaleString("en-NG")}`,
      sellerName: String(order.sellerName ?? (order as any).seller_name ?? "the seller"),
    }).catch(() => {})
  }

  if (sellerId) {
    const buyerPhone = String(buyer?.phone ?? "").trim()
    const buyerName = String(buyer?.fullName ?? (buyer as any)?.full_name ?? "The buyer")
    await AdminService.addDoc("notifications", {
      user_id: sellerId,
      type: "system",
      title: "💰 Order Payment Confirmed",
      body: buyerPhone
        ? `Payment confirmed. Escrow is active — please prepare/ship the item. ${buyerName} can be reached on ${buyerPhone}.`
        : "Payment confirmed. Escrow is active — please ship the item.",
      link: `/dashboard/seller/orders/${orderId}`,
      is_read: false,
    })

    const seller = await AdminService.getDoc("users", sellerId) as Record<string, unknown> | null
    const sellerEmail = String(seller?.email ?? "")
    if (sellerEmail) {
      Emails.orderFundedSeller(sellerEmail, {
        sellerName: String(seller?.fullName ?? (seller as any)?.full_name ?? "there"),
        itemTitle, orderId,
        totalAmount: `₦${(totalAmount / 100).toLocaleString("en-NG")}`,
        buyerName, buyerPhone,
      }).catch(() => {})
    }
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

    // charge.success: server-side safety net for order activation — see
    // file header comment. Handled first and separately from the
    // transfer.* logic below, which is unrelated (payouts, not payments).
    if (event === "charge.success") {
      const reference = String(data?.reference ?? "")
      if (!reference) return NextResponse.json({ received: true })

      // Paystack's own record is the source of truth here, not just the
      // event payload — re-verify directly rather than trusting the
      // webhook body, same caution activate-paystack already takes.
      const secretKey = process.env.PAYSTACK_SECRET_KEY
      if (secretKey) {
        try {
          const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
          })
          const verifyData = await verifyRes.json()
          if (!verifyData.status || verifyData.data?.status !== "success") {
            return NextResponse.json({ received: true })
          }
        } catch (err) {
          console.error("[webhooks/paystack] charge.success re-verify failed:", err)
          return NextResponse.json({ received: true })
        }
      }

      const all = await AdminService.getCollection("orders") as Record<string, unknown>[]
      const matching = all.filter(o => (o.paymentReference ?? (o as any).payment_reference) === reference)
      for (const order of matching) {
        try {
          await activateOrderFromWebhook(order, reference)
        } catch (err) {
          console.error("[webhooks/paystack] activateOrderFromWebhook failed for order", order.id, err)
        }
      }

      return NextResponse.json({ received: true })
    }

    // Only transfer events are relevant below. Payment/charge events are
    // handled separately by the existing verify-on-return flow
    // (create-verified-paystack / activate-paystack / create-pending-orders)
    // and, now, by the charge.success handling above — this section
    // exists specifically to close the transfer-status gap.
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

        // Keep the seller-facing "Transaction History" table (which reads
        // from the original payout row in wallet_transactions, not the
        // withdrawals table) in sync — same reasoning as the admin
        // withdrawals page's syncWithdrawalTransactionStatus helper.
        try {
          const allTx = await AdminService.getCollection("wallet_transactions") as Record<string, unknown>[]
          const payoutRow = allTx.find(t => t.type === "payout" && String(t.reference ?? "") === wId)
          if (payoutRow) {
            await AdminService.updateDoc("wallet_transactions", String(payoutRow.id), { status: "completed" })
          }
        } catch { /* best-effort — withdrawals table stays the source of truth */ }

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

        try {
          const allTx = await AdminService.getCollection("wallet_transactions") as Record<string, unknown>[]
          const payoutRow = allTx.find(t => t.type === "payout" && String(t.reference ?? "") === wId)
          if (payoutRow) {
            await AdminService.updateDoc("wallet_transactions", String(payoutRow.id), { status: "rejected" })
          }
        } catch { /* best-effort */ }

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
