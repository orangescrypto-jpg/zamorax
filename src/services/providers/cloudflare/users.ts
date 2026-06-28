// src/services/providers/cloudflare/users.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
// Provider calls /api/db/users/* routes — which handle both Vercel (HTTP API)
// and Cloudflare Pages (native D1 binding) via the nativeDB pattern.
// NO direct AdminService or d1Query calls here — service arbitration is maintained.
import type { IUsersService } from "@/src/services/users"
import type { User } from "@/src/types"

const BASE = "/api/db/users"

export const UsersService: IUsersService = {

  async getUserById(uid) {
    const res = await fetch(`${BASE}/${uid}`)
    if (!res.ok) return null
    return res.json()
  },

  async getUserByUsername(username) {
    const res = await fetch(`${BASE}?username=${encodeURIComponent(username)}`)
    if (!res.ok) return null
    return res.json()
  },

  async updateUser(uid, data) {
    const res = await fetch(`${BASE}/${uid}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    })
    if (!res.ok) throw new Error("updateUser failed")
  },

  async banUser(uid, reason) {
    if (!reason.trim()) throw new Error("Ban reason is required")
    await UsersService.updateUser(uid, { isBanned: true, banReason: reason.trim() } as any)
  },

  async unbanUser(uid) {
    await UsersService.updateUser(uid, { isBanned: false, banReason: null } as any)
  },

  async updateUserPlan(uid, plan) {
    const planExpiresAt = plan === "free" ? null : new Date(Date.now() + 30 * 86400000).toISOString()
    await UsersService.updateUser(uid, { plan, planExpiresAt } as any)
  },

  async verifySellerNIN(uid, approve) {
    await UsersService.updateUser(uid, {
      ninVerified:       approve,
      isSellerReady:     approve,
      verificationLevel: approve ? "nin" : "phone",
    } as any)
  },

  async saveFcmToken(uid, token) {
    await UsersService.updateUser(uid, { fcmToken: token } as any)
  },

  async getSettings(uid, role) {
    const res = await fetch(`/api/${role}/settings`)
    if (!res.ok) return null
    const json = await res.json()
    return json.settings ?? null
  },

  async saveSettings(uid, role, settings) {
    const res = await fetch(`/api/${role}/settings`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ settings }),
    })
    if (!res.ok) throw new Error("saveSettings failed")
  },

  async setVacationMode(uid, enabled, returnDate, message) {
    const res = await fetch("/api/seller/vacation", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ enabled, returnDate: returnDate ?? null, message: message ?? null }),
    })
    if (!res.ok) throw new Error("setVacationMode failed")
    return res.json()
  },
}
