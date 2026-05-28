// functions/src/autoResolveDisputes.ts
// Runs every hour. Auto-resolves disputes based on rules engine.
// DEPLOY: firebase deploy --only functions:autoResolveDisputes

import { onSchedule } from "firebase-functions/v2/scheduler"
import { onRequest } from "firebase-functions/v2/https"
import { initializeApp, getApps } from "firebase-admin/app"
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore"
import { defineSecret } from "firebase-functions/params"

if (!getApps().length) initializeApp()
const db = getFirestore()

// ── Secrets ───────────────────────────────────────────────────────────────────
// Set via: firebase functions:secrets:set ADMIN_TRIGGER_SECRET
const ADMIN_TRIGGER_SECRET = defineSecret("ADMIN_TRIGGER_SECRET")

// ── Rules Engine ─────────────────────────────────────────────────────────────

interface DisputeRule {
  id: string
  label: string
  matches: (dispute: FirebaseFirestore.DocumentData, order: FirebaseFirestore.DocumentData) => boolean
  resolution: {
    verdict: "refund_buyer" | "release_seller" | "partial_refund" | "escalate"
    refundPercent?: number
    notes: string
  }
}

const RULES: DisputeRule[] = [
  {
    id: "seller_no_response_48h",
    label: "Seller did not respond within 48 hours",
    matches: (dispute) => {
      const hoursSince = (Date.now() - (dispute.createdAt as Timestamp).toMillis()) / 3_600_000
      return hoursSince >= 48 && !dispute.sellerResponse
    },
    resolution: {
      verdict: "refund_buyer",
      refundPercent: 100,
      notes: "Auto-resolved: Seller did not respond within 48 hours. Full refund issued to buyer.",
    },
  },
  {
    id: "item_not_received_7d_no_tracking",
    label: "Item not received after 7 days, no tracking",
    matches: (dispute, order) => {
      if (dispute.reason !== "item_not_received") return false
      const daysSince = (Date.now() - (order.createdAt as Timestamp).toMillis()) / 86_400_000
      return daysSince >= 7 && !order.trackingNumber
    },
    resolution: {
      verdict: "refund_buyer",
      refundPercent: 100,
      notes: "Auto-resolved: No tracking number provided and item not received after 7 days.",
    },
  },
  {
    id: "item_not_received_14d",
    label: "Item not received after 14 days",
    matches: (dispute, order) => {
      if (dispute.reason !== "item_not_received") return false
      const daysSince = (Date.now() - (order.createdAt as Timestamp).toMillis()) / 86_400_000
      return daysSince >= 14 && order.status !== "delivered"
    },
    resolution: {
      verdict: "refund_buyer",
      refundPercent: 100,
      notes: "Auto-resolved: Item not received after 14 days. Full refund issued.",
    },
  },
  {
    id: "inspection_window_expired",
    label: "Inspection window expired before dispute",
    matches: (dispute, order) => {
      if (dispute.reason !== "item_not_as_described") return false
      if (!order.deliveredAt) return false
      const daysSinceDelivery = (Date.now() - (order.deliveredAt as Timestamp).toMillis()) / 86_400_000
      return daysSinceDelivery > 3
    },
    resolution: {
      verdict: "release_seller",
      notes: "Auto-resolved: 3-day inspection window expired before dispute was raised. Payment released to seller.",
    },
  },
  {
    id: "low_value_not_as_described",
    label: "Low-value item not as described",
    matches: (dispute, order) => {
      if (dispute.reason !== "item_not_as_described") return false
      return (order.totalAmount || 0) <= 500_000 // ₦5,000 in kobo
    },
    resolution: {
      verdict: "partial_refund",
      refundPercent: 50,
      notes: "Auto-resolved: Low-value item dispute. 50% goodwill refund issued.",
    },
  },
]

// ── Wallet credit helper ──────────────────────────────────────────────────────

async function creditWallet(userId: string, amount: number, description: string, orderId: string) {
  if (amount <= 0) return
  await db.collection("walletTransactions").add({
    userId, type: "credit", amount, description, orderId,
    createdAt: FieldValue.serverTimestamp(),
  })
  await db.collection("sellerWallets").doc(userId).set({
    balance:     FieldValue.increment(amount),
    totalEarned: FieldValue.increment(amount),
    updatedAt:   FieldValue.serverTimestamp(),
  }, { merge: true })
}

// ── Core resolution logic ─────────────────────────────────────────────────────

async function processDisputes() {
  const snap = await db.collection("disputes")
    .where("status", "in", ["open", "investigating"])
    .where("autoResolved", "==", false)
    .get()

  if (snap.empty) { console.log("No open disputes."); return 0 }

  const batch = db.batch()
  const postBatch: Promise<any>[] = []
  let resolved = 0

  for (const disputeDoc of snap.docs) {
    const dispute = disputeDoc.data()

    const orderSnap = dispute.orderId
      ? await db.collection("orders").doc(dispute.orderId).get()
      : null
    if (!orderSnap?.exists) continue
    const order = orderSnap.data()!

    const rule = RULES.find(r => r.matches(dispute, order))
    if (!rule) continue

    const { verdict, refundPercent, notes } = rule.resolution

    // Update dispute
    batch.update(disputeDoc.ref, {
      status:             verdict === "escalate" ? "escalated" : "resolved",
      autoResolved:       true,
      autoResolvedAt:     FieldValue.serverTimestamp(),
      autoResolvedBy:     rule.id,
      autoResolvedNotes:  notes,
      verdict,
      refundPercent:      refundPercent ?? null,
      updatedAt:          FieldValue.serverTimestamp(),
    })

    // Update order
    const orderRef = db.collection("orders").doc(dispute.orderId)
    if (verdict === "refund_buyer") {
      batch.update(orderRef, {
        status: "refunded", escrowStatus: "refunded_to_buyer",
        refundPercent: 100, updatedAt: FieldValue.serverTimestamp(),
      })
    } else if (verdict === "release_seller") {
      batch.update(orderRef, {
        status: "completed", escrowStatus: "released_to_seller",
        updatedAt: FieldValue.serverTimestamp(),
      })
      postBatch.push(
        creditWallet(dispute.sellerId, order.sellerPayout || 0,
          `Dispute resolved in your favour — order ${dispute.orderId.slice(-6).toUpperCase()}`,
          dispute.orderId)
      )
    } else if (verdict === "partial_refund" && refundPercent) {
      const sellerAmount = Math.floor((order.sellerPayout || 0) * (100 - refundPercent) / 100)
      batch.update(orderRef, {
        status: "partial_refund", escrowStatus: "partial_refund",
        refundPercent, updatedAt: FieldValue.serverTimestamp(),
      })
      if (sellerAmount > 0) {
        postBatch.push(
          creditWallet(dispute.sellerId, sellerAmount,
            `Partial payout (${100 - refundPercent}%) — order ${dispute.orderId.slice(-6).toUpperCase()}`,
            dispute.orderId)
        )
      }
    }

    // Notify both parties
    const notifBase = {
      type: "dispute_auto_resolved", disputeId: disputeDoc.id,
      orderId: dispute.orderId, body: notes, isRead: false, read: false,
      createdAt: FieldValue.serverTimestamp(),
    }
    batch.set(db.collection("notifications").doc(), {
      ...notifBase, userId: dispute.buyerId,
      title: verdict === "refund_buyer" ? "✅ Dispute resolved — refund issued" : "⚖️ Dispute resolved",
      link: `/dashboard/buyer/orders/${dispute.orderId}`,
    })
    batch.set(db.collection("notifications").doc(), {
      ...notifBase, userId: dispute.sellerId,
      title: verdict === "release_seller" ? "✅ Dispute resolved — payment released" : "⚖️ Dispute resolved",
      link: `/dashboard/seller/orders`,
    })

    resolved++
    console.log(`Rule "${rule.id}" → dispute ${disputeDoc.id} → ${verdict}`)
  }

  await batch.commit()
  await Promise.allSettled(postBatch)
  return resolved
}

// ── Scheduled function ────────────────────────────────────────────────────────

export const autoResolveDisputes = onSchedule("every 60 minutes", async () => {
  const count = await processDisputes()
  console.log(`Auto-resolved ${count} disputes.`)
})

// ── Manual trigger for admin use ─────────────────────────────────────────────

export const triggerDisputeResolution = onRequest(
  { secrets: [ADMIN_TRIGGER_SECRET] },
  async (req, res) => {
    // Validate Bearer token against the stored secret
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }
    const token = authHeader.slice(7)
    if (token !== ADMIN_TRIGGER_SECRET.value()) {
      res.status(403).json({ error: "Forbidden" })
      return
    }
    try {
      const count = await processDisputes()
      res.json({ success: true, resolved: count })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  }
)
