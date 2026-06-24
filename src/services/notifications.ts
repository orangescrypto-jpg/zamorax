// src/services/notifications.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE/FCM → NOW CLOUDFLARE D1 (data) + Web Push (future)
// ─────────────────────────────────────────────────────────────────

import type { Notification } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
// WAS: export { NotificationsService } from "@/src/services/providers/firebase/notifications"
export { NotificationsService } from "@/src/services/providers/cloudflare/notifications"
// ─────────────────────────────────────────────────────────────────

export interface INotificationsService {
  getNotifications(userId: string, limit?: number): Promise<Notification[]>
  markAsRead(notificationId: string): Promise<void>
  markAllAsRead(userId: string): Promise<void>
  subscribeToUnreadCount(userId: string, callback: (count: number) => void): () => void
  requestPushPermission(userId: string, vapidKey: string): Promise<string | null>
  subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void): () => void
}
