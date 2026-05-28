"use client"

import { useState, useEffect } from "react"
import { Bell, BellOff, X } from "lucide-react"
import { requestPushPermission } from "@/hooks/usePWA"
import { AdminService } from "@/src/services"
import { useAuth } from "@/hooks/useAuth"

export default function PushNotificationPrompt() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    if (!("Notification" in window)) return
    if (Notification.permission !== "default") return
    // Show after 30s on first visit
    const timer = setTimeout(() => setShow(true), 30000)
    return () => clearTimeout(timer)
  }, [user?.uid])

  if (!show) return null

  const handleEnable = async () => {
    setLoading(true)
    const permission = await requestPushPermission()
    if (permission === "granted" && user?.uid) {
      await AdminService.updateDoc("users", user.uid, { pushEnabled: true })
    }
    setShow(false)
    setLoading(false)
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-40 bg-card border border-border rounded-2xl shadow-xl p-4">
      <button onClick={() => setShow(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-semibold">Stay in the loop</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified about orders, offers, and messages instantly.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="flex-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? "Enabling…" : "Enable"}
            </button>
            <button
              onClick={() => setShow(false)}
              className="flex-1 text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
