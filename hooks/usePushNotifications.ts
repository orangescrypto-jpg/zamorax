// hooks/usePushNotifications.ts
"use client"
// Real Web Push (VAPID) subscribe/unsubscribe. Replaces the previous FCM
// stub -- requestPushPermission() in
// src/services/providers/cloudflare/notifications.ts never actually
// registered a subscription, so no push could ever be sent. This hook
// talks directly to the service worker's PushManager and the
// /api/push/* routes instead.

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function usePushNotifications() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    setPermission(Notification.permission)

    if (Notification.permission === "granted" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setSubscribed(!!sub))
        .catch(() => {})
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!user?.uid) return
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({
        title: "Not supported",
        description: "Push notifications aren't supported on this browser.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)
      if (permissionResult !== "granted") {
        if (permissionResult === "denied") {
          toast({
            title: "Notifications blocked",
            description: "Enable notifications in your browser settings to get updates.",
            variant: "destructive",
          })
        }
        return
      }

      const keyRes = await fetch("/api/push/vapid-public-key")
      if (!keyRes.ok) {
        toast({
          title: "Notifications unavailable",
          description: "Push notifications aren't configured yet. Try again later.",
          variant: "destructive",
        })
        return
      }
      const { publicKey } = await keyRes.json()

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      if (!saveRes.ok) throw new Error("Failed to save subscription")

      setSubscribed(true)
      toast({ title: "Notifications enabled", variant: "success" })
    } catch (err: any) {
      console.error("Push subscribe error:", err)
      toast({
        title: "Could not enable notifications",
        description: err.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user?.uid, toast])

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setSubscribed(false)
      toast({ title: "Notifications turned off" })
    } catch (err: any) {
      console.error("Push unsubscribe error:", err)
    } finally {
      setLoading(false)
    }
  }, [toast])

  return { permission, subscribed, loading, subscribe, unsubscribe }
}
