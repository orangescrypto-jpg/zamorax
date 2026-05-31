// src/services/providers/firebase/wallet.ts

import {
  doc, getDoc, setDoc, getDocs, addDoc, updateDoc,
  collection, query, where, orderBy, limit,
  increment, serverTimestamp, type DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IWalletService } from "@/src/services/wallet"
import type { SellerWallet, WalletTransaction, PayoutRequest } from "@/src/types"

type TimestampLike = { toDate: () => Date } | string | number | null | undefined

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === "object" && "toDate" in ts) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

export const WalletService: IWalletService = {

  async getWallet(userId) {
    const snap = await getDoc(doc(db, "sellerWallets", userId))
    if (!snap.exists()) return null
    const d = snap.data()
    return {
      userId,
      balance:        d.balance        ?? 0,
      pendingBalance: d.pendingBalance ?? 0,
      totalEarned:    d.totalEarned    ?? 0,
      updatedAt:      toIso(d.updatedAt),
    }
  },

  async getTransactions(userId, pageLimit = 20) {
    const q = query(
      collection(db, "sellerWallets", userId, "transactions"),
      orderBy("createdAt", "desc"),
      limit(pageLimit),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => ({
      ...d.data(),
      id:        d.id,
      createdAt: toIso(d.data().createdAt),
    } as WalletTransaction))
  },

  async requestPayout(data) {
    const ref = await addDoc(collection(db, "payoutRequests"), {
      ...data,
      status:    "pending",
      createdAt: serverTimestamp(),
    })
    return { id: ref.id }
  },

  async getPendingPayouts() {
    const q = query(collection(db, "payoutRequests"), where("status", "==", "pending"))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({
      ...d.data(),
      id:         d.id,
      createdAt:  toIso(d.data().createdAt),
      processedAt: d.data().processedAt ? toIso(d.data().processedAt) : undefined,
    } as PayoutRequest))
  },

  async updatePayoutStatus(payoutId, status, extra = {}) {
    await updateDoc(doc(db, "payoutRequests", payoutId), {
      status,
      ...extra,
      processedAt: serverTimestamp(),
    })
  },

  async getAgentWallet(userId) {
    const snap = await getDoc(doc(db, "agentWallets", userId))
    return snap.exists()
      ? { balance: snap.data().balance ?? 0, totalEarned: snap.data().totalEarned ?? 0 }
      : { balance: 0, totalEarned: 0 }
  },

  async getLogisticsAgentWallet(userId) {
    const snap = await getDoc(doc(db, "logisticsAgentWallets", userId))
    return snap.exists()
      ? { balance: snap.data().balance ?? 0, totalEarned: snap.data().totalEarned ?? 0 }
      : { balance: 0, totalEarned: 0 }
  },

  async creditLogisticsAgent(agentId, agentUserId, amountKobo, reason, shipmentId) {
    const ref  = doc(db, "logisticsAgentWallets", agentUserId)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      await updateDoc(ref, {
        balance:     increment(amountKobo),
        totalEarned: increment(amountKobo),
        updatedAt:   serverTimestamp(),
      })
    } else {
      await setDoc(ref, {
        balance:      amountKobo,
        totalEarned:  amountKobo,
        agentId,
        agentUserId,
        createdAt:    serverTimestamp(),
      })
    }

    await addDoc(collection(db, "logisticsAgentWallets", agentUserId, "transactions"), {
      amount: amountKobo, type: "logistics", reason, shipmentId, createdAt: serverTimestamp(),
    })
  },
}
