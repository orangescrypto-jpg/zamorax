// components/shared/AnnouncementBar.tsx
"use client"

import { useState, useEffect } from "react"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { X } from "lucide-react"

function hashMessage(msg: string): string {
  let hash = 0
  for (let i = 0; i < msg.length; i++) {
    hash = (Math.imul(31, hash) + msg.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

const COLOR_CLASSES = {
  info:    "bg-blue-600 text-white",
  warning: "bg-amber-500 text-white",
  success: "bg-emerald-600 text-white",
  danger:  "bg-red-600 text-white",
}

export function AnnouncementBar() {
  const { settings } = usePlatformSettings()
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !settings.announcementBarMessage) return
    const key = `announcement_dismissed_${hashMessage(settings.announcementBarMessage)}`
    if (localStorage.getItem(key) === "true") setDismissed(true)
  }, [mounted, settings.announcementBarMessage])

  if (!mounted) return null
  if (!settings.announcementBarEnabled || !settings.announcementBarMessage) return null
  if (dismissed) return null

  const colorClass = COLOR_CLASSES[settings.announcementBarColor] ?? COLOR_CLASSES.info

  const handleDismiss = () => {
    const key = `announcement_dismissed_${hashMessage(settings.announcementBarMessage)}`
    localStorage.setItem(key, "true")
    setDismissed(true)
  }

  return (
    <div className={`relative flex items-center justify-center px-8 py-2 text-sm font-medium text-center ${colorClass}`}>
      <span>{settings.announcementBarMessage}</span>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
