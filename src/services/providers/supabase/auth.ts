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

/**
 * Reads a JSON body safely. Next.js returns an HTML error page (not JSON)
 * when an API route throws an uncaught exception, so res.json() would itself
 * throw a confusing "Unexpected token <" / "Failed to fetch" style error.
 * This always returns a usable object with whatever info we could get.
 */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: text || `HTTP ${res.status} ${res.statusText}` }
  }
}

/** Fetch the app user profile from D1 via our own API */
async function fetchUserProfile(uid: string): Promise<User | null> {
  let res: Response
  try {
    res = await fetch(`/api/db/users/${uid}`, { credentials: "include" })
  } catch (err) {
    // Genuine network-level failure (offline, CORS, DNS, etc.)
    throw new Error(
      `Network error while fetching user profile: ${(err as Error).message}`,
    )
  }

  if (res.status === 404) return null

  if (!res.ok) {
    const body = await safeJson(res)
    throw new Error(
      `Failed to fetch user profile (HTTP ${res.status}): ${body.error ?? "Unknown error"}`,
    )
  }

  return safeJson(res)
}

/** Create the app user profile in D1 via our own API */
async function createUserProfile(data: Record<string, unknown>): Promise<void> {
  let res: Response
  try {
    res = await fetch("/api/db/users", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    })
  } catch (err) {
    throw new Error(
      `Network error while creating user profile: ${(err as Error).message}`,
    )
  }

  if (!res.ok) {
    const body = await safeJson(res)
    throw new Error(
      `Failed to create user profile (HTTP ${res.status}): ${body.error ?? "Unknown error"}`,
    )
  }
}

/** Update the app user profile in D1 via our own API */
async function updateUserProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  let res: Response
  try {
    res = await fetch(`/api/db/users/${uid}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    })
  } catch (err) {
    throw new Error(
      `Network error while updating user profile: ${(err as Error).message}`,
    )
  }

  if (!res.ok) {
    const body = await safeJson(res)
    throw new Error(
      `Failed to update user profile (HTTP ${res.status}): ${body.error ?? "Unknown error"}`,
    )
  }
}

// ── Implementation ───────────────────────────────────────────────

export const AuthService: IAuthService = {

  async register(data: RegisterData) {
    // Step 1: Create Supabase auth user
    const { data: authData, error } = await supabase().auth.signUp({
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
    const { data, error } = await supabase().auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error("Login failed")

    const profile = await fetchUserProfile(data.user.id)
    if (!profile) {
      throw new Error(
        "Account exists but no profile record was found. This usually means " +
        "registration partially failed (auth user created, but the D1 profile " +
        "row wasn't). Contact support or re-register.",
      )
    }
    if ((profile as any).isBanned) {
      await supabase().auth.signOut()
      throw new Error((profile as any).banReason ?? "Account suspended")
    }
    return profile
  },

  async loginWithGoogle() {
    const { data, error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options:  { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    })
    if (error) throw new Error(error.message)
    // The actual user profile fetch happens after redirect via onAuthStateChanged
    return {} as User
  },

  async signOut() {
    const { error } = await supabase().auth.signOut()
    if (error) throw new Error(error.message)
  },

  async resetPassword(email) {
    const { error } = await supabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    })
    if (error) throw new Error(error.message)
  },

  async updateProfile(uid, updates) {
    // Update D1 profile (WAS FIRESTORE → NOW D1 via API)
    await updateUserProfile(uid, { ...updates, updatedAt: new Date().toISOString() })

    // Keep Supabase auth metadata in sync (display name only)
    if (updates.fullName) {
      await supabase().auth.updateUser({ data: { full_name: updates.fullName } })
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
    const { data, error } = await supabase().auth.signInWithOtp({ phone })
    if (error) throw new Error(error.message)
    return data
  },

  // ── Auth state listener ───────────────────────────────────────
  // WAS: onAuthStateChanged (Firebase) → NOW: onAuthStateChange (Supabase)
  onAuthStateChanged(callback) {
    const { data: { subscription } } = supabase().auth.onAuthStateChange(
      async (event, session) => {
        if (!session?.user) {
          if (event === "INITIAL_SESSION") {
            // On page refresh Supabase fires INITIAL_SESSION with session=null
            // before it finishes restoring from localStorage. Retry with
            // increasing delays — the session usually appears within 500ms,
            // but on slow mobile connections it can take longer.
            const delays = [100, 300, 600, 1000]
            for (const ms of delays) {
              await new Promise(resolve => setTimeout(resolve, ms))
              try {
                const { data: { session: confirmed } } = await supabase().auth.getSession()
                if (confirmed?.user) {
                  const profile = await fetchUserProfile(confirmed.user.id).catch(() => undefined)
                  if (profile !== undefined) callback(profile)
                  return // session restored successfully
                }
              } catch { /* continue retrying */ }
            }
            // All retries exhausted — genuinely no session
          }
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

        const profile = await fetchUserProfile(session.user.id).catch((err) => {
          // A thrown error here means the profile fetch itself failed
          // (network blip, cold start, D1 hiccup) — NOT that the user has
          // no profile. Treat it as "unknown" rather than "logged out",
          // so a transient failure on page refresh doesn't bounce an
          // already-authenticated admin/user back to /login.
          console.error("fetchUserProfile failed during auth state sync:", err)
          return undefined
        })
        if (profile === undefined) return // leave existing session/user state untouched
        callback(profile) // profile is User (found) or null (genuine 404 — no profile, safe to log out)
      },
    )

    return () => subscription.unsubscribe()
  },
}
