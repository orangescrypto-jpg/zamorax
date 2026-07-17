// app/api/webhooks/flutterwave/route.ts
//
// WHY THIS EXISTS:
// Mirrors app/api/webhooks/paystack/route.ts — same two jobs, for
// Flutterwave instead of Paystack:
//
//   1. charge.completed: server-side safety net for order activation.
//      Orders should already be activated by the buyer's own return trip
//      through /payment/verify, but if that never happens (closed tab,
//      crashed browser, network drop), this webhook is the other trigger
//      that flips a still-"pending" order to escrow_held — independent of
//      anything the buyer's browser does.
//
//   2. transfer.completed / escrow transaction status changes: reconciles
//      withdrawal records against what Flutterwave says actually
//      happened, same reasoning as the Paystack transfer.* handling.
//
// Flutterwave signs webhooks with a static verif-hash header you set
// yourself in the dashboard (not HMAC like Paystack) — compare against
// FLW_WEBHOOK_SECRET_HASH.
//
// SETUP REQUIRED (do this once you're on a live key):
//   1. Flutterwave dashboard → Settings → Webhooks
//   2. Webhook URL: https://zamorax.com/api/webhooks/flutterwave
//   3. Set a "Secret Hash" in the dashboard and put the same value in
//      FLW_WEBHOOK_SECRET_HASH in your env — Flutterwave sends it back on
//      every webhook call in the verif-hash header for you to compare.
//   4. Make sure charge.completed and transfer.completed events are
//      enabled (they're on by default for most accounts).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { Emails } from "@/src/services/email"
import { ChatService } from "@/src/services/chat"

function verifyFlutterwaveSignature(signature: string): boolean {
  const secretHash = process.env.FLW_WEBHOOK_SECRET_HASH
  if (!secretHash || !signature) return false
  return signature === secretHash
}

// Mirrors activateOrderFromWebhook in webhooks/paystack/route.ts — same
// side effects (status flip, notifications, chat, emails), just gated on
// paymentProvider === "flutterwave" and idempotent against the buyer's own
// /payment/verify return-trip having already run this.
async function activateOrderFromWebhook(order: Record<string, unknown>, reference: string) {
  const orderId = String(order.id)
  if (String(order.status ?? "") === "escrow_held" || String(order.status ?? "") === "completed") {
    return // already active (or further along) — nothing to do
  }
  if (String(order.paymentProvider ?? (order as any).payment_provider ?? "") !== "flutterwave") {
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
      console.error("auto chat creation failed (webhooks/flutterwave charge.completed):", err)
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
    const signature = req.headers.get("verif-hash") ?? ""

    if (!verifyFlutterwaveSignature(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const event = String(payload.event ?? "")
    const data = payload.data ?? {}

    // ── charge.completed: order activation safety net ────────────────
    if (event === "charge.completed") {
      if (data.status !== "successful") {
        return NextResponse.json({ received: true })
      }
      const reference = String(data.tx_ref ?? "")
      if (!reference) return NextResponse.json({ received: true })

      // Re-verify server-side against Flutterwave directly rather than
      // trusting the webhook payload's amount/status outright — same
      // caution the Paystack webhook takes for charge.success.
      try {
        const secretKey = process.env.FLW_SECRET_KEY
        if (secretKey) {
          const verifyRes = await fetch(
            `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
            { headers: { Authorization: `Bearer ${secretKey}` } },
          )
          const verifyData = await verifyRes.json()
          if (verifyData.status !== "success" || verifyData.data?.status !== "successful") {
            return NextResponse.json({ received: true })
          }
        }
      } catch (err) {
        console.error("[webhooks/flutterwave] charge.completed re-verify failed:", err)
        return NextResponse.json({ received: true })
      }

      const all = await AdminService.getCollection("orders") as Record<string, unknown>[]
      const matching = all.filter(o => (o.paymentReference ?? (o as any).payment_reference) === reference)
      for (const order of matching) {
        try {
          await activateOrderFromWebhook(order, reference)
        } catch (err) {
          console.error("[webhooks/flutterwave] activateOrderFromWebhook failed for order", order.id, err)
        }
      }

      return NextResponse.json({ received: true })
    }

    // ── transfer.completed: withdrawal reconciliation ────────────────
    // Covers both plain transfers (handleFlutterwaveTransfer) and escrow
    // releases — Flutterwave fires transfer.completed for standalone
    // transfers; escrow settlements are reconciled synchronously by the
    // /api/payment/transfer response itself since escrow/settle returns
    // its result immediately, but this still catches any that need a
    // later status correction.
    if (event === "transfer.completed") {
      const reference = String(data.reference ?? "")
      const transferId = String(data.id ?? "")
      if (!reference && !transferId) return NextResponse.json({ received: true })

      // reference is set to `WD-${withdrawal.id}` when the transfer is
      // initiated — same convention as the Paystack webhook.
      const withdrawalId = reference.startsWith("WD-") ? reference.slice(3) : ""
      let withdrawal = withdrawalId
        ? (await AdminService.getDoc("withdrawals", withdrawalId) as Record<string, unknown> | null)
        : null

      if (!withdrawal && transferId) {
        const all = await AdminService.getCollection("withdrawals") as Record<string, unknown>[]
        withdrawal = all.find(w => (w.transferReference ?? (w as any).transfer_reference) === transferId) ?? null
      }

      if (!withdrawal) return NextResponse.json({ received: true })

      const wId = String(withdrawal.id)
      const now = new Date().toISOString()
      const status = String(data.status ?? "") // "SUCCESSFUL" | "FAILED"

      if (status === "SUCCESSFUL") {
        if (String(withdrawal.status) !== "completed") {
          await AdminService.updateDoc("withdrawals", wId, {
            status: "completed",
            transferReference: transferId || withdrawal.transferReference,
            paidAt: now,
            updatedAt: now,
          })

          try {
            const allTx = await AdminService.getCollection("wallet_transactions") as Record<string, unknown>[]
            const payoutRow = allTx.find(t => t.type === "payout" && String(t.reference ?? "") === wId)
            if (payoutRow) {
              await AdminService.updateDoc("wallet_transactions", String(payoutRow.id), { status: "completed" })
            }
          } catch { /* best-effort */ }

          const sellerEmail = String(withdrawal.sellerEmail ?? "")
          if (sellerEmail) {
            Emails.withdrawalPaid(sellerEmail, {
              sellerName: String(withdrawal.sellerName ?? "there"),
              amount: `₦${(Number(withdrawal.netAmount ?? withdrawal.amount ?? 0) / 100).toLocaleString("en-NG")}`,
              bankName: String(withdrawal.bankName ?? ""),
              accountNumber: String(withdrawal.accountNumber ?? ""),
              reference: transferId || reference,
            }).catch(() => {})
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

      if (status === "FAILED") {
        if (String(withdrawal.status) !== "rejected") {
          await AdminService.updateDoc("withdrawals", wId, {
            status: "rejected",
            rejectionReason: `Flutterwave transfer failed: ${data.complete_message ?? "no reason given"}`,
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
              description: `Withdrawal reversed — funds returned to wallet (Flutterwave transfer failed)`,
              reference: transferId || reference,
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
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("[webhooks/flutterwave] error:", err)
    // Still return 200 — Flutterwave retries on non-2xx, and a webhook
    // that's failing due to a bug shouldn't hammer the endpoint indefinitely.
    return NextResponse.json({ received: true })
  }
}
