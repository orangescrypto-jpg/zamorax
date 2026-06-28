// src/services/users.ts
// WAS FIREBASE → NOW CLOUDFLARE D1
import type { User } from "@/src/types"
export { UsersService } from "@/src/services/providers/cloudflare/users"
export interface IUsersService {
  getUserById(uid: string): Promise<User | null>
  getUserByUsername(username: string): Promise<User | null>
  updateUser(uid: string, data: Partial<User>): Promise<void>
  banUser(uid: string, reason: string): Promise<void>
  unbanUser(uid: string): Promise<void>
  updateUserPlan(uid: string, plan: "free" | "starter" | "pro"): Promise<void>
  verifySellerNIN(uid: string, approve: boolean): Promise<void>
  saveFcmToken(uid: string, token: string): Promise<void>
  // Settings — role is "seller" | "buyer" | "moderator"
  getSettings(uid: string, role: string): Promise<Record<string, unknown> | null>
  saveSettings(uid: string, role: string, settings: Record<string, unknown>): Promise<void>
  // Vacation mode (seller only)
  setVacationMode(uid: string, enabled: boolean, returnDate?: string | null, message?: string | null): Promise<{ listingCount: number }>
}
