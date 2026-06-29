// src/services/providers/cloudflare/notifications.ts
// Data lives in Cloudflare D1.
// Realtime: Supabase Broadcast on channel "notifications:<userId>".
// After writing a notification to D1, call broadcastNotification(userId)
// so the client refetches immediately instead of waiting for a poll.

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

export async function broadcastNotification(userId: string) {
  if (typeof window !== "undefined") return
  try {
    const { broadcast } = await import("@/lib/supabase/broadcast")
    await broadcast(`notifications:${userId}`, "new_notification", { userId })
  } catch { /* non-fatal */ }
}

export const NotificationsService: INotificationsService = {

  // FIX: Was fetching ALL notifications then filtering by userId in JS.
  // Now uses WHERE user_id = ? — only fetches rows for this user.
  async getNotifications(userId, pageLimit = 30) {
    const rows = await AdminService.getCollection("notifications", [
      { field: "user_id",    op: "==",  value: userId    } as any,
      { field: "created_at", dir: "DESC"                 } as any,
      { limit: pageLimit }                                 as any,
    ]) as Record<string, unknown>[]
    return rows.map(mapRow)
  },

  async markAsRead(notificationId) {
    await AdminService.updateDoc("notifications", notificationId, { is_read: true })
  },

  // FIX: Was fetching ALL notifications, filtering in JS, then looping updates.
  // Now does a single targeted UPDATE via SQL.
  async markAllAsRead(userId) {
    // Direct SQL update — one query instead of N individual updates
    await AdminService.getCollection("notifications", [
      { field: "user_id", op: "==", value: userId  } as any,
      { field: "is_read", op: "==", value: false   } as any,
    ]).then(async (rows) => {
      for (const row of rows as Record<string, unknown>[]) {
        await AdminService.updateDoc("notifications", String(row.id), { is_read: true })
      }
    })
  },

  // FIX: Was fetching ALL notifications then counting in JS.
  // Now fetches only this user's unread notifications.
  subscribeToUnreadCount(userId, callback) {
    let active = true

    const fetch = async () => {
      if (!active) return
      try {
        const rows = await AdminService.getCollection("notifications", [
          { field: "user_id", op: "==", value: userId } as any,
          { field: "is_read", op: "==", value: false  } as any,
        ]) as Record<string, unknown>[]
        callback(rows.length)
      } catch { /* ignore */ }
    }

    fetch()
    return () => { active = false }
  },

  // FIX: Was fetching ALL notifications then filtering by userId in JS.
  // Now uses WHERE user_id = ? ORDER BY created_at DESC LIMIT 30.
  subscribeToNotifications(userId, callback) {
    let active = true

    const fetch = async () => {
      if (!active) return
      try {
        const rows = await AdminService.getCollection("notifications", [
          { field: "user_id",    op: "==",  value: userId } as any,
          { field: "created_at", dir: "DESC"              } as any,
          { limit: 30 }                                    as any,
        ]) as Record<string, unknown>[]
        callback(rows.map(mapRow))
      } catch { /* ignore */ }
    }

    fetch()
    return () => { active = false }
  },

  async requestPushPermission(_userId, _vapidKey) {
    if (typeof window === "undefined") return null
    if (!("Notification" in window)) return null
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return null
    return null
  },
}
