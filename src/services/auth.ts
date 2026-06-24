// src/services/auth.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE → NOW SUPABASE (Auth only)
// ─────────────────────────────────────────────────────────────────

import type { User, RegisterData } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
// WAS: export { AuthService } from "@/src/services/providers/firebase/auth"
export { AuthService } from "@/src/services/providers/supabase/auth"
// ─────────────────────────────────────────────────────────────────

export interface IAuthService {
  register(data: RegisterData): Promise<{ user: User; needsPhoneVerification: boolean }>
  login(email: string, password: string): Promise<User>
  loginWithGoogle(): Promise<User>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  updateProfile(uid: string, updates: Partial<{
    fullName: string
    username: string
    profilePhoto: string
    storeName: string
    storeDescription: string
  }>): Promise<void>
  setupRecaptcha(containerId: string): Promise<unknown>
  sendPhoneOTP(phone: string, recaptchaVerifier: unknown): Promise<unknown>
  onAuthStateChanged(callback: (user: User | null) => void): () => void
}
