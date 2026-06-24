// src/services/providers/cloudflare/users.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { IUsersService } from "@/src/services/users"
import type { User } from "@/src/types"

function mapRow(row: Record<string, unknown>): User {
  return {
    ...row,
    uid:               String(row.uid ?? row.id),
    email:             String(row.email ?? ""),
    phone:             row.phone ? String(row.phone) : null,
    fullName:          String(row.full_name ?? row.fullName ?? ""),
    username:          row.username ? String(row.username) : undefined,
    role:              String(row.role ?? "buyer"),
    plan:              String(row.plan ?? "free"),
    planExpiresAt:     row.plan_expires_at ? String(row.plan_expires_at) : null,
    verificationLevel: String(row.verification_level ?? row.verificationLevel ?? "none"),
    ninVerified:       !!row.nin_verified,
    bvnVerified:       !!row.bvn_verified,
    phoneVerified:     !!row.phone_verified,
    emailVerified:     !!row.email_verified,
    isBanned:          !!row.is_banned,
    banReason:         row.ban_reason ? String(row.ban_reason) : undefined,
    activeListingCount: Number(row.active_listing_count ?? 0),
    sellerRating:      Number(row.seller_rating ?? 0),
    totalSales:        Number(row.total_sales ?? 0),
    totalRentals:      Number(row.total_rentals ?? 0),
    isSellerReady:     !!row.is_seller_ready,
    profilePhoto:      row.profile_photo ? String(row.profile_photo) : undefined,
    storeName:         row.store_name ? String(row.store_name) : undefined,
    storeDescription:  row.store_description ? String(row.store_description) : undefined,
    createdAt:         String(row.created_at ?? new Date().toISOString()),
    updatedAt:         String(row.updated_at ?? new Date().toISOString()),
  } as User
}

export const UsersService: IUsersService = {

  async getUserById(uid) {
    const row = await AdminService.getDoc("users", uid)
    if (!row) return null
    return mapRow(row as Record<string, unknown>)
  },

  async getUserByUsername(username) {
    const all = (await AdminService.getCollection("users")) as Record<string, unknown>[]
    const row = all.find(r => String(r.username ?? "").toLowerCase() === username.toLowerCase())
    return row ? mapRow(row) : null
  },

  async updateUser(uid, data) {
    await AdminService.updateDoc("users", uid, data)
  },

  async banUser(uid, reason) {
    if (!reason.trim()) throw new Error("Ban reason is required")
    await AdminService.updateDoc("users", uid, {
      is_banned:  true,
      ban_reason: reason.trim(),
      banned_at:  new Date().toISOString(),
    })
  },

  async unbanUser(uid) {
    await AdminService.updateDoc("users", uid, { is_banned: false, ban_reason: null, banned_at: null })
  },

  async updateUserPlan(uid, plan) {
    const planExpiresAt = plan === "free" ? null : new Date(Date.now() + 30 * 86400000).toISOString()
    await AdminService.updateDoc("users", uid, { plan, plan_expires_at: planExpiresAt })
  },

  async verifySellerNIN(uid, approve) {
    await AdminService.updateDoc("users", uid, {
      nin_verified:       approve ? 1 : 0,
      is_seller_ready:    approve ? 1 : 0,
      verification_level: approve ? "nin" : "phone",
      nin_verified_at:    approve ? new Date().toISOString() : null,
    })
  },

  async saveFcmToken(uid, token) {
    // FCM removed — store token for future Web Push
    await AdminService.updateDoc("users", uid, { fcm_token: token })
  },
}
