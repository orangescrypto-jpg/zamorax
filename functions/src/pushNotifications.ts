"use client"
// hooks/usePushNotifications.ts

import { useEffect, useState } from "react"
import { getMessaging, getToken, onMessage } from "firebase/messaging"
import { doc, updateDoc } from "firebase/firestore"
import { app, db } from "@/lib/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!

export function usePushNotifications() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    setPermission(Notification.permission)
  }, [])

  const requestPermission = async () => {
    if (!user?.uid) return
    if (!("Notification" in window)) return
    if (!("serviceWorker" in navigator)) return

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== "granted") {
        toast({
          title: "Notifications blocked",
          description: "Enable notifications in your browser settings to get order updates.",
          variant: "destructive",
        })
        return
      }

      const messaging = getMessaging(app)
      const swReg     = await navigator.serviceWorker.ready
      const fcmToken  = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })

      if (!fcmToken) return
      setToken(fcmToken)

      // Save FCM token to user's Firestore document
      await updateDoc(doc(db, "users", user.uid), {
        fcmToken,
        fcmTokenUpdatedAt: new Date().toISOString(),
      })

      toast({ title: "Notifications enabled! 🔔", variant: "success" })

      // Handle foreground messages
      onMessage(messaging, payload => {
        const { title, body } = payload.notification || {}
        toast({
          title: title || "Zamorax",
          description: body,
          variant: "success",
        })
      })

    } catch (e: any) {
      console.error("FCM token error:", e)
    }
  }

  return { permission, token, requestPermission }
}
