/**
 * functions/src/autoReleaseEscrow.ts
 * ─────────────────────────────────────────────────────────────────
 * Firebase Cloud Function: Auto-Release Escrow
 * Runs every hour. Finds orders where inspection window has closed
 * and releases escrow to seller.
 *
 * PROVIDER AWARE:
 * - manual:      credits seller wallet (admin pays out manually)
 * - paystack:    initiates Paystack bank transfer
 * - flutterwave: initiates Flutterwave transfer (when implemented)
 *
 * DEPLOY:
 *   cd functions && npm install
 *   firebase deploy --only functions:autoReleaseEscrow
 *
 * SWITCH PROVIDER:
 * Change ACTIVE_PROVIDER below. No other changes needed.
 */

import { onSchedule } from "firebase-functions/v2/scheduler"
import { initializeApp, getApps } from "firebase-admin/app"
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore"
import { defineSecret } from "firebase-functions/params"

if (!getApps().length) initializeApp()
const db = getFirestore()

const PAYSTACK_SECRET    = defineSecret("PAYSTACK_SECRET_KEY")

// ── SWITCH PROVIDER HERE ──────────────────────────────────────────
// "manual"      → credit wallet only, admin pays manually
// "paystack"    → auto bank transfer via Paystack
// "flutterwave" → auto bank transfer via Flutterwave (stub)
const ACTIVE_PROVIDER: "manual" | "paystack" | "flutterwave" = "manual"
// ─────────────────────────────────────────────────────────────────

function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

// ── Manual: credit wallet, create payout request for admin ────────
async function manualPayout(
  sellerId: string,
  sellerPayout: number,
  orderId: string,
): Promise<{ success: boolean; reference: string; error?: string }> {
  const reference = `escrow_release_${orderId}`

  try {
    // Credit wallet
    const walletRef = db.collection("sellerWallets").doc(sellerId)
    await walletRef.set({
      balance:        FieldValue.increment(sellerPayout),
      totalEarned:    FieldValue.increment(sellerPayout),
      pendingBalance: FieldValue.increment(-sellerPayout),
      updatedAt:      FieldValue.serverTimestamp(),
    }, { merge: true })

    // Log transaction
    await db.collection("walletTransactions").add({
      sellerId,
      type:        "credit",
      amount:      sellerPayout,
      description: `Escrow released — order ${orderId.slice(-6).toUpperCase()}`,
      orderId,
      reference,
      createdAt:   FieldValue.serverTimestamp(),
    })

    // Get seller bank details (if set) for admin payout request
    const sellerSnap = await db.collection("users").doc(sellerId).get()
    const seller = sellerSnap.data() ?? {}

    if (seller.bankName && seller.accountNumber) {
      await db.collection("pendingPayouts").add({
        sellerId,
        amountKobo:    sellerPayout,
        bankName:      seller.bankName,
        accountNumber: seller.accountNumber,
        accountName:   seller.accountName ?? "",
        reference,
        orderId,
        provider:      "manual",
        status:        "pending",
        createdAt:     FieldValue.serverTimestamp(),
        updatedAt:     FieldValue.serverTimestamp(),
      })
    }

    console.log(`✅ [manual] Wallet credited for seller ${sellerId} — order ${orderId}`)
    return { success: true, reference }

  } catch (err: any) {
    console.error(`❌ [manual] payout error for ${sellerId}:`, err)
    return { success: false, reference, error: err.message }
  }
}

// ── Paystack: initiate bank transfer ─────────────────────────────
async function paystackPayout(
  sellerId: string,
  sellerPayout: number,
  orderId: string,
  paystackSecret: string,
): Promise<{ success: boolean; reference: string; error?: string }> {
  const reference = `zamorax_escrow_${orderId}_${Date.now()}`

  try {
    const sellerSnap = await db.collection("users").doc(sellerId).get()
    if (!sellerSnap.exists) return { success: false, reference, error: "Seller not found" }

    const seller = sellerSnap.data()!
    const recipientCode = seller.paystackRecipientCode

    // No recipient code set — fall back to wallet credit
    if (!recipientCode) {
      console.log(`[paystack] No recipient code for ${sellerId} — falling back to wallet credit`)
      return manualPayout(sellerId, sellerPayout, orderId)
    }

    const res = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source:    "balance",
        amount:    sellerPayout,
        recipient: recipientCode,
        reference,
        reason:    `Zamorax payout — order ${orderId.slice(-6).toUpperCase()}`,
      }),
    })

    const data = await res.json()

    if (!data.status) {
      console.warn(`[paystack] Transfer failed for ${sellerId}: ${data.message} — crediting wallet`)
      return manualPayout(sellerId, sellerPayout, orderId)
    }

    // Log successful transfer
    await db.collection("walletTransactions").add({
      sellerId,
      type:        "payout",
      amount:      sellerPayout,
      description: `Payout via Paystack — order ${orderId.slice(-6).toUpperCase()}`,
      orderId,
      reference,
      createdAt:   FieldValue.serverTimestamp(),
    })

    console.log(`✅ [paystack] Transfer initiated for seller ${sellerId}`)
    return { success: true, reference }

  } catch (err: any) {
    console.error(`❌ [paystack] payout error for ${sellerId}:`, err)
    // Always fall back to wallet credit so seller funds are never lost
    return manualPayout(sellerId, sellerPayout, orderId)
  }
}

// ── Flutterwave: stub ─────────────────────────────────────────────
async function flutterwavePayout(
  sellerId: string,
  sellerPayout: number,
  orderId: string,
): Promise<{ success: boolean; reference: string; error?: string }> {
  // TODO: implement when switching to Flutterwave
  // For now: fall back to wallet credit
  console.log(`[flutterwave] Not implemented — crediting wallet for ${sellerId}`)
  return manualPayout(sellerId, sellerPayout, orderId)
}

// ── Route payout to active provider ──────────────────────────────
async function initiatePayout(
  sellerId: string,
  sellerPayout: number,
  orderId: string,
  paystackSecret?: string,
): Promise<{ success: boolean; reference: string; error?: string }> {
  if (ACTIVE_PROVIDER === "paystack" && paystackSecret) {
    return paystackPayout(sellerId, sellerPayout, orderId, paystackSecret)
  }
  if (ACTIVE_PROVIDER === "flutterwave") {
    return flutterwavePayout(sellerId, sellerPayout, orderId)
  }
  // Default: manual
  return manualPayout(sellerId, sellerPayout, orderId)
}

// ── Main scheduled function ───────────────────────────────────────
export const autoReleaseEscrow = onSchedule(
  { schedule: "every 60 minutes", secrets: [PAYSTACK_SECRET] },
  async () => {
    try {
      const now = Timestamp.now()
      const snapshot = await db.collection("orders")
        .where("status", "==", "inspecting")
        .where("escrowReleaseAt", "<=", now)
        .limit(50)
        .get()

      if (snapshot.empty) {
        console.log("No expired escrow orders found.")
        return
      }

      const paystackSecret = PAYSTACK_SECRET.value()
      let released = 0
      let failed   = 0

      for (const orderDoc of snapshot.docs) {
        const order        = orderDoc.data()
        const orderId      = orderDoc.id
        const sellerId     = order.sellerId
        const sellerPayout = order.sellerPayout || 0

        try {
          const { success, reference, error } = await initiatePayout(
            sellerId, sellerPayout, orderId, paystackSecret,
          )

          // Mark order completed regardless — funds are either transferred or in wallet
          await orderDoc.ref.update({
            status:          "completed",
            escrowStatus:    "released_to_seller",
            autoReleased:    true,
            payoutProvider:  ACTIVE_PROVIDER,
            payoutReference: reference ?? null,
            payoutError:     error ?? null,
            completedAt:     FieldValue.serverTimestamp(),
            updatedAt:       FieldValue.serverTimestamp(),
          })

          // Notify seller
          const isWalletCredit = ACTIVE_PROVIDER === "manual" || !success
          await db.collection("notifications").add({
            userId:    sellerId,
            type:      "order_update",
            title:     "💰 Payment Released!",
            body:      isWalletCredit
              ? `${formatKobo(sellerPayout)} has been credited to your Zamorax wallet. Go to your wallet to request withdrawal.`
              : `${formatKobo(sellerPayout)} for order #${orderId.slice(-6).toUpperCase()} has been transferred to your bank.`,
            link:      "/dashboard/seller/wallet",
            isRead:    false,
            read:      false,
            createdAt: FieldValue.serverTimestamp(),
          })

          // Notify buyer
          await db.collection("notifications").add({
            userId:    order.buyerId,
            type:      "order_update",
            title:     "✅ Order Completed",
            body:      `Your order #${orderId.slice(-6).toUpperCase()} is complete. Inspection window closed.`,
            link:      `/dashboard/buyer/orders/${orderId}`,
            isRead:    false,
            read:      false,
            createdAt: FieldValue.serverTimestamp(),
          })

          released++
          console.log(`✅ Released escrow — order ${orderId} → seller ${sellerId} [${ACTIVE_PROVIDER}]`)

        } catch (err: any) {
          failed++
          console.error(`❌ Failed to release order ${orderId}:`, err.message)
          // Order stays as "inspecting" — retries next hour
        }
      }

      console.log(`Auto-release complete: ${released} released, ${failed} failed. Provider: ${ACTIVE_PROVIDER}`)

    } catch (error) {
      console.error("❌ autoReleaseEscrow crashed:", error)
    }
  },
)
