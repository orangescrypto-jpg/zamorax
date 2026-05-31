// src/services/providers/firebase/notifications.ts

import {
  collection, doc, getDocs, updateDoc, query,
  where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch,
  DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { INotificationsService } from "@/src/services/notifications"
import type { Notification } from "@/src/types"

type TimestampLike = { toDate: () => Date } | string | number | null | undefined

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (typeof ts === "object" && "toDate" in ts) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapNotification(id: string, data: DocumentData): Notification {
  return {
    ...data,
    id,
    isRead:    data.isRead ?? data.read ?? false,
    createdAt: toIso(data.createdAt),
  } as Notification
}
import { getMessaging, getToken, onMessage } from "firebase/messaging"
import { app } from "@/lib/firebase/config"

export const NotificationsService: INotificationsService = {

  async getNotifications(userId, pageLimit = 30) {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(pageLimit),
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => mapNotification(d.id, d.data()))
  },

  async markAsRead(notificationId) {
    await updateDoc(doc(db, "notifications", notificationId), {
      isRead: true, read: true,
    })
  },

  async markAllAsRead(userId) {
    const q = query(
      collection(db, "notifications"),
      where("userId",  "==", userId),
      where("isRead",  "==", false),
    )
    const snap = await getDocs(q)
    if (snap.empty) return
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.update(d.ref, { isRead: true, read: true }))
    await batch.commit()
  },

  subscribeToUnreadCount(userId, callback) {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("isRead", "==", false),
    )
    return onSnapshot(q, snap => callback(snap.size))
  },

  async requestPushPermission(userId, vapidKey) {
    if (typeof window === "undefined") return null
    if (!("Notification" in window)) return null
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return null
    try {
      const messaging = getMessaging(app)
      const swReg = await navigator.serviceWorker.ready
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg })
      return token || null
    } catch {
      return null
    }
  },

  subscribeToNotifications(userId, callback) {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(30),
    )
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapNotification(d.id, d.data())))
    })
  },
}
