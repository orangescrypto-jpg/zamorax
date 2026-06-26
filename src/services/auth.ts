// src/services/auth.ts
// ─────────────────────────────────────────────────────────────────
// Auth provider switch — Firebase (auth only)
// All app data lives in Cloudflare D1 via /api routes.
// ─────────────────────────────────────────────────────────────────

import type { User, RegisterData } from "@/src/types"

export { AuthService } from "@/src/services/providers/firebase/auth"

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
