// src/services/providers/firebase/users.ts

import {
  doc, getDoc, getDocs, updateDoc, query, collection,
  where, limit, serverTimestamp,
  DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IUsersService } from "@/src/services/users"
import type { User } from "@/src/types"

type TimestampLike = { toDate: () => Date } | string | number | null | undefined

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === "object" && "toDate" in ts) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapUser(uid: string, data: DocumentData): User {
  return {
    ...data,
    uid,
    createdAt:     toIso(data.createdAt),
    updatedAt:     toIso(data.updatedAt),
    planExpiresAt: data.planExpiresAt ? toIso(data.planExpiresAt) : null,
  } as User
}

export const UsersService: IUsersService = {

  async getUserById(uid) {
    const snap = await getDoc(doc(db, "users", uid))
    if (!snap.exists()) return null
    return mapUser(uid, snap.data())
  },

  async getUserByUsername(username) {
    const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null
    return mapUser(snap.docs[0].id, snap.docs[0].data())
  },

  async updateUser(uid, data) {
    await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() })
  },

  async banUser(uid, reason) {
    if (!reason.trim()) throw new Error("Ban reason is required")
    await updateDoc(doc(db, "users", uid), {
      isBanned:  true,
      banReason: reason.trim(),
      bannedAt:  serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  },

  async unbanUser(uid) {
    await updateDoc(doc(db, "users", uid), {
      isBanned:  false,
      banReason: null,
      bannedAt:  null,
      updatedAt: serverTimestamp(),
    })
  },

  async updateUserPlan(uid, plan) {
    const expiresAt = plan === "free"
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await updateDoc(doc(db, "users", uid), {
      plan,
      planExpiresAt: expiresAt,
      updatedAt:     serverTimestamp(),
    })
  },

  async verifySellerNIN(uid, approve) {
    await updateDoc(doc(db, "users", uid), {
      ninVerified:       approve,
      isSellerReady:     approve,
      verificationLevel: approve ? "nin" : "phone",
      ninVerifiedAt:     approve ? serverTimestamp() : null,
      updatedAt:         serverTimestamp(),
    })
  },

  async saveFcmToken(uid, token) {
    await updateDoc(doc(db, "users", uid), { fcmToken: token, updatedAt: serverTimestamp() })
  },
}
