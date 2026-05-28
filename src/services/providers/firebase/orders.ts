// src/services/providers/firebase/orders.ts

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, startAfter, onSnapshot,
  serverTimestamp, type DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IOrdersService } from "@/src/services/orders"
import type { Order, PaginatedResult } from "@/src/types"

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (ts?.toDate) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapOrder(id: string, data: DocumentData): Order {
  return {
    ...data,
    id,
    createdAt:       toIso(data.createdAt),
    updatedAt:       toIso(data.updatedAt),
    escrowReleaseAt: data.escrowReleaseAt ? toIso(data.escrowReleaseAt) : undefined,
    completedAt:     data.completedAt     ? toIso(data.completedAt)     : undefined,
    deliveredAt:     data.deliveredAt     ? toIso(data.deliveredAt)     : undefined,
    refundedAt:      data.refundedAt      ? toIso(data.refundedAt)      : undefined,
    rentalStart:     data.rentalStart     ? toIso(data.rentalStart)     : undefined,
    rentalEnd:       data.rentalEnd       ? toIso(data.rentalEnd)       : undefined,
  } as Order
}

const PAGE_SIZE = 20

export const OrdersService: IOrdersService = {

  async getOrderById(id) {
    const snap = await getDoc(doc(db, "orders", id))
    if (!snap.exists()) return null
    return mapOrder(snap.id, snap.data())
  },

  async getOrdersByBuyer(buyerId, cursor) {
    const constraints = [
      where("buyerId", "==", buyerId),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
      ...(cursor ? [startAfter(cursor)] : []),
    ]
    const snap = await getDocs(query(collection(db, "orders"), ...constraints))
    return {
      items:      snap.docs.map(d => mapOrder(d.id, d.data())),
      nextCursor: snap.docs[snap.docs.length - 1] ?? null,
      hasMore:    snap.docs.length === PAGE_SIZE,
    }
  },

  async getOrdersBySeller(sellerId, cursor) {
    const constraints = [
      where("sellerId", "==", sellerId),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
      ...(cursor ? [startAfter(cursor)] : []),
    ]
    const snap = await getDocs(query(collection(db, "orders"), ...constraints))
    return {
      items:      snap.docs.map(d => mapOrder(d.id, d.data())),
      nextCursor: snap.docs[snap.docs.length - 1] ?? null,
      hasMore:    snap.docs.length === PAGE_SIZE,
    }
  },

  async createOrder(data) {
    const ref = await addDoc(collection(db, "orders"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: ref.id }
  },

  async updateOrderStatus(orderId, status, extra = {}) {
    await updateDoc(doc(db, "orders", orderId), {
      status,
      ...extra,
      updatedAt: serverTimestamp(),
    })
  },

  async confirmDelivery(orderId, buyerId) {
    const escrowReleaseAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h window
    await updateDoc(doc(db, "orders", orderId), {
      status:          "inspecting",
      deliveredAt:     serverTimestamp(),
      escrowReleaseAt,
      updatedAt:       serverTimestamp(),
    })
  },

  async releaseEscrow(orderId, buyerId) {
    await updateDoc(doc(db, "orders", orderId), {
      status:          "completed",
      escrowStatus:    "released_to_seller",
      releasedToSeller: true,
      completedAt:     serverTimestamp(),
      updatedAt:       serverTimestamp(),
    })
  },

  subscribeToOrder(orderId, callback) {
    return onSnapshot(doc(db, "orders", orderId), snap => {
      callback(snap.exists() ? mapOrder(snap.id, snap.data()) : null)
    })
  },

  subscribeToAllOrders(callback) {
    return onSnapshot(collection(db, "orders"), snap => {
      callback(snap.docs.map(d => mapOrder(d.id, d.data())))
    })
  },

  async getAllOrders() {
    const snap = await getDocs(collection(db, "orders"))
    return snap.docs.map(d => mapOrder(d.id, d.data()))
  },
}
