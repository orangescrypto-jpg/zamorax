// src/services/providers/supabase/auth.ts  — NEW FILE
// Supabase implementation of IAuthService.
// Replaces src/services/providers/firebase/auth.ts

import { createClient } from "@/lib/supabase/client"
import type { IAuthService } from "@/src/services/auth"
import type { User, RegisterData } from "@/src/types"

async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try { return text ? JSON.parse(text) : {} }
  catch { return { error: text || `HTTP ${res.status} ${res.statusText}` } }
}

async function fetchUserProfile(uid: string): Promise<User | null> {
  const res = await fetch(`/api/db/users/${uid}`, { credentials: "include" })
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await safeJson(res)
    throw new Error(`Failed to fetch user profile (HTTP ${res.status}): ${body.error ?? "Unknown"}`)
  }
  return safeJson(res)
}

export const AuthService: IAuthService = {

  async register(data: RegisterData) {
    const res = await fetch("/api/auth/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email:            data.email,
        password:         data.password,
        fullName:         data.fullName,
        username:         data.username,
        phone:            data.phone,
        role:             data.role ?? "buyer",
        storeName:        data.storeName,
        storeDescription: data.storeDescription,
        nigerianState:    data.nigerianState,
        nin:              data.nin,
        referredBy:       data.referredBy,
      }),
    })
    const json = await safeJson(res)
    if (!res.ok) throw new Error(json.error ?? "Registration failed")

    return {
      user: json.user as User,
      needsPhoneVerification: false,
    }
  },

  async login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    })
    const json = await safeJson(res)
    if (!res.ok) throw new Error(json.error ?? "Login failed")

    const profile = await fetchUserProfile(json.user.id)
    if (!profile) throw new Error("Profile not found")
    return profile
  },

  async loginWithGoogle() {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options:  { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw new Error(error.message)
    // OAuth redirects — this promise never resolves normally
    return {} as User
  },

  async signOut() {
    await fetch("/api/auth/signout", { method: "POST", credentials: "include" })
    const supabase = createClient()
    await supabase.auth.signOut()
  },

  async resetPassword(email: string) {
    const res = await fetch("/api/auth/reset-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    })
    const json = await safeJson(res)
    if (!res.ok) throw new Error(json.error ?? "Reset failed")
  },

  async updateProfile(uid: string, updates: Partial<{
    fullName: string
    username: string
    profilePhoto: string
    storeName: string
    storeDescription: string
  }>) {
    const res = await fetch(`/api/db/users/${uid}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(updates),
    })
    if (!res.ok) {
      const body = await safeJson(res)
      throw new Error(`Update failed (HTTP ${res.status}): ${body.error ?? "Unknown"}`)
    }
  },

  // Not used with Supabase but kept for interface compatibility
  async setupRecaptcha(_containerId: string) { return null },
  async sendPhoneOTP(_phone: string, _verifier: unknown) { return null },

  onAuthStateChanged(callback: (user: User | null) => void) {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        callback(null)
        return
      }
      try {
        const profile = await fetchUserProfile(session.user.id)
        callback(profile)
      } catch {
        callback(null)
      }
    })

    return () => subscription.unsubscribe()
  },
}
