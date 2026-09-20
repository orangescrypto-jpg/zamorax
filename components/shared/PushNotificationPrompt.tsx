"use client"
// components/shared/PushNotificationPrompt.tsx
// Banner prompting the user to enable real Web Push (VAPID) notifications.
// Gated by sub-settings.pushMasterEnabled -- the admin's master switch for
// the whole push feature -- as well as the existing platformSettings
// pushNotifsEnabled / pushOptInPromptDelaySec, which continue to control
// timing. If either master toggle is off, the banner never shows.
import { useState, useEffect, useRef } from "react"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useSubSettings } from "@/hooks/useSubSettings"
import { usePushNotifications } from "@/hooks/usePushNotifications"

export function PushNotificationPrompt() {
  const { user } = useAuth()
  const { settings, loading } = usePlatformSettings()
  const { settings: subSettings, loading: subLoading } = useSubSettings()
  const { subscribed, subscribe } = usePushNotifications()
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (loading || subLoading) return
    if (!settings.pushNotifsEnabled) return
    if (!subSettings.pushMasterEnabled) return
    if (!user?.uid || subscribed || dismissed) return
    if (!("Notification" in window) || Notification.permission !== "default") return
    const delaySec = settings.pushOptInPromptDelaySec ?? 30
    timerRef.current = setTimeout(() => setShow(true), delaySec * 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [loading, subLoading, settings.pushNotifsEnabled, subSettings.pushMasterEnabled, settings.pushOptInPromptDelaySec, user, subscribed, dismissed])

  const handleAllow = async () => {
    setShow(false)
    await subscribe()
  }

  const handleDismiss = () => { setShow(false); setDismissed(true) }

  if (!show) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in">
      <div className="bg-card border border-border rounded-xl shadow-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Stay updated</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified about orders, messages, new listings from sellers you follow, and price drops.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-7 text-xs" onClick={handleAllow}>Allow</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleDismiss}>Not now</Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default PushNotificationPrompt
