"use client"

import { useEffect, useState } from "react"

export function usePWA() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => { setIsInstalled(true); setPrompt(null) })
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === "accepted") setIsInstalled(true)
    setPrompt(null)
  }

  return { canInstall: !!prompt && !isInstalled, isInstalled, install }
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied"
  if (Notification.permission === "granted") return "granted"
  return Notification.requestPermission()
}
