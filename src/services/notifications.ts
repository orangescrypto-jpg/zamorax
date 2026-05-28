// src/services/notifications.ts
// ─────────────────────────────────────────────────────────────────
// Notifications service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { Notification } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { NotificationsService } from "@/src/services/providers/firebase/notifications"
// ─────────────────────────────────────────────────────────────────

export interface INotificationsService {
  getNotifications(userId: string, limit?: number): Promise<Notification[]>
  markAsRead(notificationId: string): Promise<void>
  markAllAsRead(userId: string): Promise<void>

  /** Real-time unread count badge */
  subscribeToUnreadCount(userId: string, callback: (count: number) => void): () => void

  /** Real-time notification feed */
  /** Request push notification permission and save FCM token */
  requestPushPermission(userId: string, vapidKey: string): Promise<string | null>

  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
  ): () => void
}
