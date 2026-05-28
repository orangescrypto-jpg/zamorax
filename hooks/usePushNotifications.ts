"use client"
// hooks/usePushNotifications.ts

import { useEffect, useState } from "react"
import { NotificationsService, UsersService } from "@/src/services"
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
      const fcmToken = await NotificationsService.requestPushPermission(user.uid, VAPID_KEY)

      if (!fcmToken) {
        if (Notification.permission !== "granted") {
          toast({
            title: "Notifications blocked",
            description: "Enable notifications in your browser settings to get order updates.",
            variant: "destructive",
          })
        }
        return
      }

      setPermission("granted")
      setToken(fcmToken)

      await UsersService.saveFcmToken(user.uid, fcmToken)

      toast({ title: "Notifications enabled! 🔔", variant: "success" })

    } catch (e: any) {
      console.error("Push notification error:", e)
    }
  }

  return { permission, token, requestPermission }
}
