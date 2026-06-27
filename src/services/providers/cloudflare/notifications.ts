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

// ── Server-side broadcast helper ─────────────────────────────────────────────
// Call this from any API route after inserting a notification row into D1.
// e.g. await broadcastNotification(userId)
export async function broadcastNotification(userId: string) {
  if (typeof window !== "undefined") return // client-side guard
  try {
    const { broadcast } = await import("@/lib/supabase/broadcast")
    await broadcast(`notifications:${userId}`, "new_notification", { userId })
  } catch { /* non-fatal */ }
}

export const NotificationsService: INotificationsService = {

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

  // ── subscribeToUnreadCount ────────────────────────────────────────────────
  // Initial fetch only. UI layer wires up useSupabaseRealtime to refetch
  // when a broadcast fires on "notifications:<userId>".
  subscribeToUnreadCount(userId, callback) {
    let active = true

    const fetch = async () => {
      if (!active) return
      try {
        const rows = await AdminService.getCollection("notifications") as Record<string, unknown>[]
        const count = rows.filter(r => (r.user_id ?? r.userId) === userId && !r.is_read).length
        callback(count)
      } catch { /* ignore */ }
    }

    fetch()
    return () => { active = false }
  },

  // ── subscribeToNotifications ──────────────────────────────────────────────
  // Initial fetch only. UI layer wires up useSupabaseRealtime to refetch
  // when a broadcast fires on "notifications:<userId>".
  subscribeToNotifications(userId, callback) {
    let active = true

    const fetch = async () => {
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
