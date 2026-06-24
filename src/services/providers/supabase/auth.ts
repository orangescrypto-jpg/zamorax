// src/services/providers/supabase/auth.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE → NOW SUPABASE
// Supabase implementation of IAuthService.
// ONLY this file ever touches @supabase/supabase-js.
// All user profile data is stored in D1 (via /api/db/* routes),
// not in Supabase — Supabase is auth-only.
// ─────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase/client"
import type { IAuthService } from "@/src/services/auth"
import type { User, RegisterData } from "@/src/types"

// ── Helpers ──────────────────────────────────────────────────────

/** Fetch the app user profile from D1 via our own API */
async function fetchUserProfile(uid: string): Promise<User | null> {
  try {
    const res = await fetch(`/api/db/users/${uid}`, { credentials: "include" })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

/** Create the app user profile in D1 via our own API */
async function createUserProfile(data: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/db/users", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create user profile")
}

/** Update the app user profile in D1 via our own API */
async function updateUserProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/db/users/${uid}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to update user profile")
}

// ── Implementation ───────────────────────────────────────────────

export const AuthService: IAuthService = {

  async register(data: RegisterData) {
    // Step 1: Create Supabase auth user
    const { data: authData, error } = await supabase.auth.signUp({
      email:    data.email,
      password: data.password,
      options:  {
        data: {
          full_name: data.fullName,
          username:  data.username?.toLowerCase(),
          phone:     data.phone ?? null,
          role:      data.role ?? "buyer",
        },
      },
    })
    if (error) throw new Error(error.message)
    if (!authData.user) throw new Error("Registration failed — no user returned")

    const uid = authData.user.id

    // Step 2: Create profile row in D1 (WAS FIRESTORE → NOW D1 via API)
    await createUserProfile({
      uid,
      email:             data.email,
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
      createdAt:         new Date().toISOString(),
      updatedAt:         new Date().toISOString(),
    })

    const profile = await fetchUserProfile(uid)
    return {
      user:                   profile ?? ({ uid, email: data.email } as User),
      needsPhoneVerification: true,
    }
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error("Login failed")

    const profile = await fetchUserProfile(data.user.id)
    if (!profile) throw new Error("User record not found")
    if ((profile as any).isBanned) {
      await supabase.auth.signOut()
      throw new Error((profile as any).banReason ?? "Account suspended")
    }
    return profile
  },

  async loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options:  { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    })
    if (error) throw new Error(error.message)
    // The actual user profile fetch happens after redirect via onAuthStateChanged
    return {} as User
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  },

  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    })
    if (error) throw new Error(error.message)
  },

  async updateProfile(uid, updates) {
    // Update D1 profile (WAS FIRESTORE → NOW D1 via API)
    await updateUserProfile(uid, { ...updates, updatedAt: new Date().toISOString() })

    // Keep Supabase auth metadata in sync (display name only)
    if (updates.fullName) {
      await supabase.auth.updateUser({ data: { full_name: updates.fullName } })
    }
  },

  // ── Phone OTP — Supabase phone auth ──────────────────────────
  // Note: Requires phone provider enabled in Supabase Dashboard →
  // Authentication → Providers → Phone
  async setupRecaptcha(_containerId) {
    // Supabase uses its own OTP flow — no reCAPTCHA needed
    return null
  },

  async sendPhoneOTP(phone, _recaptchaVerifier) {
    const { data, error } = await supabase.auth.signInWithOtp({ phone })
    if (error) throw new Error(error.message)
    return data
  },

  // ── Auth state listener ───────────────────────────────────────
  // WAS: onAuthStateChanged (Firebase) → NOW: onAuthStateChange (Supabase)
  onAuthStateChanged(callback) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session?.user) {
          callback(null)
          return
        }

        // If Google OAuth sign-in, create profile if it doesn't exist yet
        if (event === "SIGNED_IN" && session.user.app_metadata?.provider === "google") {
          try {
            let profile = await fetchUserProfile(session.user.id)
            if (!profile) {
              await createUserProfile({
                uid:               session.user.id,
                email:             session.user.email ?? "",
                fullName:          session.user.user_metadata?.full_name ?? "",
                profilePhoto:      session.user.user_metadata?.avatar_url ?? null,
                phone:             null,
                username:          session.user.email?.split("@")[0].toLowerCase(),
                role:              "buyer",
                plan:              "free",
                planExpiresAt:     null,
                verificationLevel: "none",
                ninVerified:       false,
                bvnVerified:       false,
                phoneVerified:     false,
                emailVerified:     true,
                isBanned:          false,
                activeListingCount: 0,
                sellerRating:      0,
                totalSales:        0,
                totalRentals:      0,
                isSellerReady:     false,
                createdAt:         new Date().toISOString(),
                updatedAt:         new Date().toISOString(),
              })
              profile = await fetchUserProfile(session.user.id)
            }
            callback(profile)
          } catch {
            callback(null)
          }
          return
        }

        const profile = await fetchUserProfile(session.user.id)
        callback(profile)
      },
    )

    return () => subscription.unsubscribe()
  },
}
