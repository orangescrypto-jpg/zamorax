// src/services/providers/firebase/disputes.ts

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query,
  where, orderBy, limit, startAfter, writeBatch, serverTimestamp,
  type DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IDisputesService } from "@/src/services/disputes"
import type { Dispute, PaginatedResult } from "@/src/types"

const PAGE_SIZE = 20

type TimestampLike = { toDate: () => Date } | string | number | null | undefined

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === "object" && "toDate" in ts) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapDispute(id: string, data: DocumentData): Dispute {
  return {
    ...data,
    id,
    createdAt:          toIso(data.createdAt),
    updatedAt:          toIso(data.updatedAt),
    resolvedAt:         data.resolvedAt         ? toIso(data.resolvedAt)         : undefined,
    autoResolvedAt:     data.autoResolvedAt      ? toIso(data.autoResolvedAt)     : undefined,
    sellerRespondedAt:  data.sellerRespondedAt   ? toIso(data.sellerRespondedAt)  : undefined,
  } as Dispute
}

export const DisputesService: IDisputesService = {

  async getDisputeById(id) {
    const snap = await getDoc(doc(db, "disputes", id))
    if (!snap.exists()) return null
    return mapDispute(snap.id, snap.data())
  },

  async getDisputesByUser(userId, cursor) {
    const constraints = [
      where("buyerId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
      ...(cursor ? [startAfter(cursor)] : []),
    ]
    const snap = await getDocs(query(collection(db, "disputes"), ...constraints))
    return {
      items:      snap.docs.map(d => mapDispute(d.id, d.data())),
      nextCursor: snap.docs[snap.docs.length - 1] ?? null,
      hasMore:    snap.docs.length === PAGE_SIZE,
    }
  },

  async openDispute(data) {
    const ref = await addDoc(collection(db, "disputes"), {
      ...data,
      status:    "open",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    // Mark the order as disputed
    await updateDoc(doc(db, "orders", data.orderId), {
      status:    "disputed",
      disputeId: ref.id,
      updatedAt: serverTimestamp(),
    })

    // Notify seller immediately
    await addDoc(collection(db, "notifications"), {
      userId:    data.sellerId,
      type:      "dispute_opened",
      title:     "A Dispute Has Been Filed",
      body:      `A buyer filed a dispute for order #${data.orderId.slice(-6).toUpperCase()}. Reason: ${data.reason}. Respond within 48 hours to avoid auto-resolution.`,
      orderId:   data.orderId,
      disputeId: ref.id,
      isRead:    false,
      createdAt: serverTimestamp(),
    })

    return { id: ref.id }
  },

  async respondToDispute(disputeId, sellerId, response) {
    await updateDoc(doc(db, "disputes", disputeId), {
      sellerResponse:    response,
      sellerRespondedAt: serverTimestamp(),
      status:            "investigating",
      updatedAt:         serverTimestamp(),
    })
  },

  async resolveDispute(disputeId, orderId, resolution, adminUid, addToPublicLedger = false) {
    const batch = writeBatch(db)

    batch.update(doc(db, "disputes", disputeId), {
      status:          "resolved",
      resolution,
      resolvedBy:      adminUid,
      resolvedAt:      serverTimestamp(),
      isPublicLedger:  addToPublicLedger,
      publicSummary:   `Resolved by admin: ${resolution}. ${new Date().toLocaleDateString()}`,
      updatedAt:       serverTimestamp(),
    })

    let orderUpdates: Record<string, any> = {
      status:    resolution === "refunded" ? "refunded" : "completed",
      updatedAt: serverTimestamp(),
    }

    if (resolution === "refunded") {
      orderUpdates = { ...orderUpdates, releasedToSeller: false, refundedAt: serverTimestamp() }
    } else if (resolution === "released") {
      orderUpdates = { ...orderUpdates, releasedToSeller: true,  releasedAt: serverTimestamp() }
    } else if (resolution === "split") {
      orderUpdates = { ...orderUpdates, splitPayout: true, resolvedAt: serverTimestamp() }
    }

    batch.update(doc(db, "orders", orderId), orderUpdates)

    // Fetch order for financial operations (refund + split both need it)
    const orderSnap = await getDoc(doc(db, "orders", orderId))
    if (orderSnap.exists()) {
      const orderData = orderSnap.data()

      // ── Handle refund: charge insurance pool ──────────────────
      if (resolution === "refunded") {
        const insuranceAmount = orderData.insuranceAmount ?? 0
        if (insuranceAmount > 0) {
          const currentMonth = new Date().toISOString().slice(0, 7)
          // Read pool doc first to get correct running totals
          const poolSnap = await getDoc(doc(db, "insurancePool", currentMonth))
          const pool = poolSnap.exists() ? poolSnap.data() : { claimsCount: 0, claimsAmount: 0, netBalance: 0 }
          batch.update(doc(db, "insurancePool", currentMonth), {
            claimsCount:  (pool.claimsCount  ?? 0) + 1,
            claimsAmount: (pool.claimsAmount ?? 0) + insuranceAmount,
            netBalance:   (pool.netBalance   ?? 0) - insuranceAmount,
            updatedAt:    serverTimestamp(),
          })
        }
      }

      // ── Handle split: credit both buyer and seller wallets ────
      if (resolution === "split") {
        const total      = orderData.totalAmount     ?? 0
        const commission = orderData.commissionAmount ?? Math.floor(total * 0.05)
        const net        = total - commission
        const buyerShare = Math.floor(net * 0.5)
        const sellerShare = net - buyerShare

        // Credit buyer wallet
        if (orderData.buyerId && buyerShare > 0) {
          const buyerWalletRef = doc(db, "buyerWallets", orderData.buyerId)
          const buyerSnap = await getDoc(buyerWalletRef)
          const buyerBal = buyerSnap.exists() ? (buyerSnap.data().balance ?? 0) : 0
          batch.update(buyerWalletRef, {
            balance:        buyerBal + buyerShare,
            totalRefunded:  (buyerSnap.data()?.totalRefunded ?? 0) + buyerShare,
            updatedAt:      serverTimestamp(),
          })
        }

        // Credit seller wallet
        if (orderData.sellerId && sellerShare > 0) {
          const sellerWalletRef = doc(db, "sellerWallets", orderData.sellerId)
          const sellerSnap = await getDoc(sellerWalletRef)
          const sellerBal = sellerSnap.exists() ? (sellerSnap.data().balance ?? 0) : 0
          batch.update(sellerWalletRef, {
            balance:       sellerBal + sellerShare,
            totalEarned:   (sellerSnap.data()?.totalEarned ?? 0) + sellerShare,
            updatedAt:     serverTimestamp(),
          })
        }

        // Notify both parties
        batch.set(doc(collection(db, "notifications")), {
          userId: orderData.buyerId, type: "split_payout",
          title: "Dispute Resolved — Split Payout",
          body: `₦${(buyerShare/100).toLocaleString("en-NG")} has been credited to your wallet.`,
          isRead: false, createdAt: serverTimestamp(),
        })
        batch.set(doc(collection(db, "notifications")), {
          userId: orderData.sellerId, type: "split_payout",
          title: "Dispute Resolved — Split Payout",
          body: `₦${(sellerShare/100).toLocaleString("en-NG")} has been credited to your wallet.`,
          isRead: false, createdAt: serverTimestamp(),
        })
      }
    }

    await batch.commit()
  },
}
