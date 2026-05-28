// src/services/providers/firebase/admin.ts
// Firebase implementation of IAdminService.

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, where, serverTimestamp,
  DocumentData, QueryConstraint, WhereFilterOp,
  writeBatch, arrayUnion, arrayRemove, increment } from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IAdminService } from "@/src/services/admin"
import type { FirestoreDoc } from "@/src/types"

function mapDoc(id: string, data: DocumentData): FirestoreDoc {
  return { id, ...data }
}

export const AdminService: IAdminService = {
  subscribeToUsers(callback) {
    return onSnapshot(collection(db, "users"), snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToListings(callback) {
    return onSnapshot(collection(db, "listings"), snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToDisputes(callback) {
    return onSnapshot(collection(db, "disputes"), snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToSubscriptions(callback) {
    return onSnapshot(collection(db, "subscriptions"), snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToBoosts(callback) {
    return onSnapshot(collection(db, "boosts"), snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToWithdrawals(callback) {
    return onSnapshot(collection(db, "withdrawals"), snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToPendingPayouts(callback) {
    const q = query(collection(db, "payoutRequests"), where("status", "==", "pending"))
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToPendingReports(callback) {
    const q = query(collection(db, "listingReports"), where("status", "==", "pending"))
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToSearchAlerts(callback) {
    return onSnapshot(collection(db, "searchAlerts"), snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToActiveBundles(callback) {
    const q = query(collection(db, "bundles"), where("status", "==", "active"))
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())) as never)
    })
  },

  subscribeToCollection(path, callback, constraints = []) {
    const q = constraints.length
      ? query(collection(db, path), ...(constraints as QueryConstraint[]))
      : collection(db, path)
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())))
    })
  },

  subscribeToCollectionWhere(path, field, op, value, callback) {
    const q = query(collection(db, path), where(field, op as WhereFilterOp, value))
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapDoc(d.id, d.data())))
    })
  },

  async getCollection(path, constraints = []) {
    const q = constraints.length
      ? query(collection(db, path), ...(constraints as QueryConstraint[]))
      : collection(db, path)
    const snap = await getDocs(q)
    return snap.docs.map(d => mapDoc(d.id, d.data()))
  },

  async updateDoc(collectionPath, docId, data) {
    await updateDoc(doc(db, collectionPath, docId), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  },

  async addDoc(collectionPath, data) {
    const ref = await addDoc(collection(db, collectionPath), {
      ...data,
      createdAt: serverTimestamp(),
    })
    return { id: ref.id }
  },

  async deleteDoc(collectionPath, docId) {
    await deleteDoc(doc(db, collectionPath, docId))
  },

  async setDoc(collectionPath, docId, data, options) {
    await setDoc(doc(db, collectionPath, docId), data, options || {})
  },

  async getDoc(collectionPath, docId) {
    const snap = await getDoc(doc(db, collectionPath, docId))
    if (!snap.exists()) return null
    return mapDoc(snap.id, snap.data())
  },,

  batch() {
    return writeBatch(db)
  },

  async updateDocRaw(collectionPath: string, docId: string, data: Record<string, unknown>) {
    await updateDoc(doc(db, collectionPath, docId), data)
  },
}
