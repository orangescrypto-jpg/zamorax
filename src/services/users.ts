// src/services/users.ts
// ─────────────────────────────────────────────────────────────────
// Users service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { User } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { UsersService } from "@/src/services/providers/firebase/users"
// ─────────────────────────────────────────────────────────────────

export interface IUsersService {
  getUserById(uid: string): Promise<User | null>
  getUserByUsername(username: string): Promise<User | null>

  updateUser(uid: string, data: Partial<User>): Promise<void>

  banUser(uid: string, reason: string): Promise<void>
  unbanUser(uid: string): Promise<void>
  updateUserPlan(uid: string, plan: "free" | "starter" | "pro"): Promise<void>

  /** Admin: approve or reject NIN verification */
  verifySellerNIN(uid: string, approve: boolean): Promise<void>

  /** Save FCM push token */
  saveFcmToken(uid: string, token: string): Promise<void>
}
