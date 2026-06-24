// src/services/providers/cloudflare/notifications.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE/FCM → NOW CLOUDFLARE D1 + Web Push (no FCM)
// Realtime onSnapshot → polling every 30s
// FCM push tokens → Web Push / removed for now
// TODO: Durable Objects or Cloudflare Queues for realtime later
// ─────────────────────────────────────────────────────────────────

import type { INotificationsService } from "@/src/services/notifications"
import type { Notification } from "@/src/types"
import { AdminService } from "@/src/services/admin"

function mapRow(row: Record<string, unknown>): Notification {
  return {
    id:        String(row.id),
    userId:    String(row.user_id ?? row.userId),
    title:     String(row.title ?? ""),
    body:      String(row.body ?? row.message ?? ""),
    type:      String(row.type ?? ""),
    link:      row.link ? String(row.link) : undefined,
    isRead:    !!row.is_read,
    read:      !!row.is_read,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  } as Notification
}

export const NotificationsService: INotificationsService = {

  // WAS: onSnapshot(query) → NOW: one-time fetch (D1)
  async getNotifications(userId, pageLimit = 30) {
    const rows = await AdminService.getCollection("notifications") as Record<string, unknown>[]
    return rows
      .filter(r => (r.user_id ?? r.userId) === userId)
      .slice(0, pageLimit)
      .map(mapRow)
  },

  async markAsRead(notificationId) {
    await AdminService.updateDoc("notifications", notificationId, { isRead: true, read: true, is_read: true })
  },

  async markAllAsRead(userId) {
    const rows = await AdminService.getCollection("notifications") as Record<string, unknown>[]
    const unread = rows.filter(r => (r.user_id ?? r.userId) === userId && !r.is_read)
    for (const row of unread) {
      await AdminService.updateDoc("notifications", String(row.id), { is_read: true })
    }
  },

  // WAS: onSnapshot → NOW: poll every 30s
  // TODO: Durable Objects realtime later
  subscribeToUnreadCount(userId, callback) {
    let active = true

    const run = async () => {
      if (!active) return
      try {
        const rows = await AdminService.getCollection("notifications") as Record<string, unknown>[]
        const count = rows.filter(r => (r.user_id ?? r.userId) === userId && !r.is_read).length
        callback(count)
      } catch { /* ignore */ }
      if (active) setTimeout(run, 30_000)
    }

    run()
    return () => { active = false }
  },

  subscribeToNotifications(userId, callback) {
    let active = true

    const run = async () => {
      if (!active) return
      try {
        const rows = await AdminService.getCollection("notifications") as Record<string, unknown>[]
        callback(
          rows
            .filter(r => (r.user_id ?? r.userId) === userId)
            .slice(0, 30)
            .map(mapRow),
        )
      } catch { /* ignore */ }
      if (active) setTimeout(run, 30_000)
    }

    run()
    return () => { active = false }
  },

  // WAS: Firebase Cloud Messaging (FCM) → NOW: Web Push (or disabled)
  // FCM is removed. If you need push, use Cloudflare Workers + Web Push API.
  async requestPushPermission(_userId, _vapidKey) {
    if (typeof window === "undefined") return null
    if (!("Notification" in window)) return null
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return null
    // TODO: Register Cloudflare Worker Web Push endpoint
    // For now return null — no FCM
    return null
  },
}
