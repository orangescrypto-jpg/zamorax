// src/services/providers/firebase/auth.ts
// ─────────────────────────────────────────────────────────────────
// Firebase implementation of IAuthService.
// ONLY this file (and other files in providers/firebase/) ever
// touch the firebase/* packages. The rest of the app is clean.
// ─────────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  UserCredential,
} from "firebase/auth"
import {
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
} from "firebase/firestore"
import { auth, db } from "@/lib/firebase/config"
import type { IAuthService } from "@/src/services/auth"
import type { User, RegisterData } from "@/src/types"

// ── Helpers ──────────────────────────────────────────────────────

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (ts?.toDate) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapFirestoreUser(uid: string, data: DocumentData): User {
  return {
    ...data,
    uid,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    planExpiresAt: data.planExpiresAt ? toIso(data.planExpiresAt) : null,
  } as User
}

// ── Implementation ───────────────────────────────────────────────

export const AuthService: IAuthService = {
  async register(data: RegisterData) {
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth, data.email, data.password,
    )
    const { user } = userCredential

    const now = serverTimestamp()
    await setDoc(doc(db, "users", user.uid), {
      uid:               user.uid,
      email:             user.email,
      phone:             data.phone ?? null,
      fullName:          data.fullName,
      username:          data.username?.toLowerCase(),
      role:              data.role ?? "buyer",
      plan:              "free",
      planExpiresAt:     null,
      verificationLevel: "none",
      ninVerified:       false,
      bvnVerified:       false,
      phoneVerified:     false,
      isBanned:          false,
      activeListingCount: 0,
      sellerRating:      0,
      totalSales:        0,
      totalRentals:      0,
      isSellerReady:     false,
      createdAt:         now,
      updatedAt:         now,
    })

    await sendEmailVerification(user)

    const snap = await getDoc(doc(db, "users", user.uid))
    return {
      user:                    mapFirestoreUser(user.uid, snap.data()),
      needsPhoneVerification:  true,
    }
  },

  async login(email, password) {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(doc(db, "users", credential.user.uid))
    if (!snap.exists()) throw new Error("User record not found")
    const data = snap.data()
    if (data.isBanned) {
      await firebaseSignOut(auth)
      throw new Error(data.banReason ?? "Account suspended")
    }
    return mapFirestoreUser(credential.user.uid, data)
  },

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    const userRef = doc(db, "users", result.user.uid)
    const snap = await getDoc(userRef)

    if (!snap.exists()) {
      const now = serverTimestamp()
      await setDoc(userRef, {
        uid:               result.user.uid,
        email:             result.user.email,
        fullName:          result.user.displayName,
        profilePhoto:      result.user.photoURL,
        phone:             null,
        username:          result.user.email?.split("@")[0].toLowerCase(),
        role:              "buyer",
        plan:              "free",
        planExpiresAt:     null,
        verificationLevel: "none",
        ninVerified:       false,
        bvnVerified:       false,
        phoneVerified:     false,
        isBanned:          false,
        activeListingCount: 0,
        sellerRating:      0,
        totalSales:        0,
        totalRentals:      0,
        isSellerReady:     false,
        createdAt:         now,
        updatedAt:         now,
      })
    }

    const freshSnap = await getDoc(userRef)
    return mapFirestoreUser(result.user.uid, freshSnap.data())
  },

  async signOut() {
    await firebaseSignOut(auth)
  },

  async resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  },

  async updateProfile(uid, updates) {
    if (updates.fullName || updates.profilePhoto) {
      await updateProfile(auth.currentUser!, {
        displayName: updates.fullName,
        photoURL:    updates.profilePhoto,
      })
    }
    await updateDoc(doc(db, "users", uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  },

  async setupRecaptcha(containerId) {
    if (typeof window === "undefined") return null
    return new RecaptchaVerifier(auth, containerId, {
      size:     "invisible",
      callback: () => {},
    })
  },

  async sendPhoneOTP(phone, recaptchaVerifier) {
    return signInWithPhoneNumber(auth, phone, recaptchaVerifier as RecaptchaVerifier)
  },

  onAuthStateChanged(callback) {
    return firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null)
        return
      }
      const snap = await getDoc(doc(db, "users", firebaseUser.uid))
      if (!snap.exists()) {
        callback(null)
        return
      }
      callback(mapFirestoreUser(firebaseUser.uid, snap.data()))
    })
  },
}
