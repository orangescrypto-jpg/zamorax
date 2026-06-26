// src/services/providers/firebase/auth.ts
// Firebase implementation of IAuthService.
// ONLY this file and lib/firebase/* ever touch the Firebase SDK.
// All user profile data is stored in D1 (via /api/db/* routes).

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendEmailVerification,
  type User as FirebaseUser,
} from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase/config"
import type { IAuthService } from "@/src/services/auth"
import type { User, RegisterData } from "@/src/types"

// ── Helpers ──────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try { return text ? JSON.parse(text) : {} }
  catch { return { error: text || `HTTP ${res.status} ${res.statusText}` } }
}

async function fetchUserProfile(uid: string): Promise<User | null> {
  let res: Response
  try {
    res = await fetch(`/api/db/users/${uid}`, { credentials: "include" })
  } catch (err) {
    throw new Error(`Network error while fetching user profile: ${(err as Error).message}`)
  }
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await safeJson(res)
    throw new Error(`Failed to fetch user profile (HTTP ${res.status}): ${body.error ?? "Unknown"}`)
  }
  return safeJson(res)
}

async function createUserProfile(data: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/db/users", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await safeJson(res)
    throw new Error(`Failed to create user profile (HTTP ${res.status}): ${body.error ?? "Unknown"}`)
  }
}

async function updateUserProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/db/users/${uid}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await safeJson(res)
    throw new Error(`Failed to update user profile (HTTP ${res.status}): ${body.error ?? "Unknown"}`)
  }
}

// ── Implementation ───────────────────────────────────────────────

export const AuthService: IAuthService = {

  async register(data: RegisterData) {
    // Step 1: Create Firebase auth user
    const credential = await createUserWithEmailAndPassword(
      firebaseAuth(),
      data.email,
      data.password,
    )
    const fbUser = credential.user

    // Update display name
    await firebaseUpdateProfile(fbUser, { displayName: data.fullName })

    // Send verification email
    try { await sendEmailVerification(fbUser) } catch { /* non-fatal */ }

    const uid = fbUser.uid

    // Step 2: Create profile row in D1 via API
    await createUserProfile({
      uid,
      email:              data.email,
      phone:              data.phone ?? null,
      fullName:           data.fullName,
      username:           data.username?.toLowerCase(),
      role:               data.role ?? "buyer",
      plan:               "free",
      planExpiresAt:      null,
      verificationLevel:  "none",
      ninVerified:        false,
      bvnVerified:        false,
      phoneVerified:      false,
      emailVerified:      false,
      isBanned:           false,
      activeListingCount: 0,
      sellerRating:       0,
      totalSales:         0,
      totalRentals:       0,
      isSellerReady:      false,
      createdAt:          new Date().toISOString(),
      updatedAt:          new Date().toISOString(),
    })

    const profile = await fetchUserProfile(uid)
    return {
      user:                   profile ?? ({ uid, email: data.email } as User),
      needsPhoneVerification: true,
    }
  },

  async login(email, password) {
    const credential = await signInWithEmailAndPassword(firebaseAuth(), email, password)
    const profile    = await fetchUserProfile(credential.user.uid)
    if (!profile) {
      throw new Error(
        "Account exists but no profile record was found. " +
        "Contact support or re-register.",
      )
    }
    if ((profile as any).isBanned) {
      await firebaseAuth().signOut()
      throw new Error((profile as any).banReason ?? "Account suspended")
    }
    return profile
  },

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(firebaseAuth(), provider)
    // The actual profile fetch happens in onAuthStateChanged below
    return {} as User
  },

  async signOut() {
    await firebaseSignOut(firebaseAuth())
    // Clear httpOnly server cookies
    try {
      await fetch("/api/auth/signout", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
      })
    } catch { /* non-fatal */ }
  },

  async resetPassword(email) {
    await sendPasswordResetEmail(firebaseAuth(), email, {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    })
  },

  async updateProfile(uid, updates) {
    await updateUserProfile(uid, { ...updates, updatedAt: new Date().toISOString() })
    const fbUser = firebaseAuth().currentUser
    if (fbUser && updates.fullName) {
      await firebaseUpdateProfile(fbUser, { displayName: updates.fullName })
    }
  },

  async setupRecaptcha(_containerId) {
    // Not needed for Firebase email/password auth
    return null
  },

  async sendPhoneOTP(_phone, _recaptchaVerifier) {
    throw new Error("Phone OTP not implemented for Firebase in this setup.")
  },

  onAuthStateChanged(callback) {
    const unsubscribe = firebaseOnAuthStateChanged(
      firebaseAuth(),
      async (fbUser: FirebaseUser | null) => {
        if (!fbUser) {
          callback(null)
          return
        }

        // Google OAuth — create profile if it doesn't exist
        const isGoogle = fbUser.providerData.some(p => p.providerId === "google.com")
        if (isGoogle) {
          try {
            let profile = await fetchUserProfile(fbUser.uid)
            if (!profile) {
              await createUserProfile({
                uid:                fbUser.uid,
                email:              fbUser.email ?? "",
                fullName:           fbUser.displayName ?? "",
                profilePhoto:       fbUser.photoURL ?? null,
                phone:              null,
                username:           fbUser.email?.split("@")[0].toLowerCase(),
                role:               "buyer",
                plan:               "free",
                planExpiresAt:      null,
                verificationLevel:  "none",
                ninVerified:        false,
                bvnVerified:        false,
                phoneVerified:      false,
                emailVerified:      true,
                isBanned:           false,
                activeListingCount: 0,
                sellerRating:       0,
                totalSales:         0,
                totalRentals:       0,
                isSellerReady:      false,
                createdAt:          new Date().toISOString(),
                updatedAt:          new Date().toISOString(),
              })
              profile = await fetchUserProfile(fbUser.uid)
            }
            callback(profile)
          } catch { callback(null) }
          return
        }

        const profile = await fetchUserProfile(fbUser.uid).catch(err => {
          console.error("fetchUserProfile failed during auth state sync:", err)
          return undefined
        })
        if (profile === undefined) return
        callback(profile)
      },
    )
    return unsubscribe
  },
}
