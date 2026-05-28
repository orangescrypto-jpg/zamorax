// src/services/auth.ts
// ─────────────────────────────────────────────────────────────────
// Auth service — public interface.
// The rest of the app imports ONLY from this file.
// To swap Firebase for Supabase/Appwrite/custom: change the one
// provider import below. Nothing else changes.
// ─────────────────────────────────────────────────────────────────

import type { User, RegisterData } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { AuthService } from "@/src/services/providers/firebase/auth"
// Future swap example:
// export { AuthService } from "@/src/services/providers/supabase/auth"
// ─────────────────────────────────────────────────────────────────

// ── Interface contract (for reference & type-checking) ───────────
export interface IAuthService {
  /** Create account and send email verification */
  register(data: RegisterData): Promise<{ user: User; needsPhoneVerification: boolean }>

  /** Sign in with email + password. Throws if banned. */
  login(email: string, password: string): Promise<User>

  /** Sign in with Google popup. Creates Firestore user doc if new. */
  loginWithGoogle(): Promise<User>

  /** Sign out current user */
  signOut(): Promise<void>

  /** Send password reset email */
  resetPassword(email: string): Promise<void>

  /** Update display name / photo in auth + user doc */
  updateProfile(uid: string, updates: Partial<{
    fullName: string
    username: string
    profilePhoto: string
    storeName: string
    storeDescription: string
  }>): Promise<void>

  /** Set up invisible reCAPTCHA for phone OTP */
  setupRecaptcha(containerId: string): Promise<unknown>

  /** Start phone OTP flow — returns confirmation result */
  sendPhoneOTP(phone: string, recaptchaVerifier: unknown): Promise<unknown>

  /** Subscribe to auth state changes — returns unsubscribe fn */
  onAuthStateChanged(callback: (user: User | null) => void): () => void
}
