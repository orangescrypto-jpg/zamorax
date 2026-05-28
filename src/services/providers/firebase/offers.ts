// src/services/providers/firebase/offers.ts

import {
  collection, doc, addDoc, updateDoc, getDocs, query,
  where, orderBy, serverTimestamp, type DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IOffersService } from "@/src/services/offers"
import type { Offer } from "@/src/types"

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (ts?.toDate) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapOffer(id: string, data: DocumentData): Offer {
  return {
    ...data,
    id,
    createdAt:   toIso(data.createdAt),
    updatedAt:   toIso(data.updatedAt),
    expiresAt:   toIso(data.expiresAt),
    respondedAt: data.respondedAt ? toIso(data.respondedAt) : undefined,
  } as Offer
}

export const OffersService: IOffersService = {

  async makeOffer(data) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    const ref = await addDoc(collection(db, "offers"), {
      ...data,
      status:    "pending",
      expiresAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: ref.id }
  },

  async respondToOffer(offerId, action, counterAmount) {
    await updateDoc(doc(db, "offers", offerId), {
      status:       action,
      respondedAt:  serverTimestamp(),
      updatedAt:    serverTimestamp(),
      ...(counterAmount !== undefined ? { counterAmount } : {}),
    })
  },

  async getOffersByBuyer(buyerId) {
    const q = query(
      collection(db, "offers"),
      where("buyerId", "==", buyerId),
      orderBy("createdAt", "desc"),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => mapOffer(d.id, d.data()))
  },

  async getOffersBySeller(sellerId) {
    const q = query(
      collection(db, "offers"),
      where("sellerId", "==", sellerId),
      orderBy("createdAt", "desc"),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => mapOffer(d.id, d.data()))
  },
}
