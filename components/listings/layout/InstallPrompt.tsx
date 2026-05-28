// BeforeInstallPromptEvent is not in lib.dom.d.ts, declare it
interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

let deferredPrompt: BeforeInstallPromptEvent | null = null

export function InstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    // Listen for the browser's "Before Install Prompt" event
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing automatically on Android
      e.preventDefault()
      deferredPrompt = e
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Show the native install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice

    // Clear the deferredPrompt so it can only be used once
    deferredPrompt = null
    setIsInstallable(false)
  }

  if (!isInstallable) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 z-50 animate-in slide-in-from-bottom-5 fade-in">
      <div className="bg-secondary text-white p-3 rounded-xl shadow-xl flex items-center justify-between gap-3 border border-primary/50">
        <div className="text-sm">
          <p className="font-bold">Get the Zamorax App</p>
          <p className="text-secondary-foreground/80 text-xs">Fast, secure, and offline-ready.</p>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90 text-white whitespace-nowrap" onClick={handleInstallClick}>
          <Download className="h-4 w-4 mr-1" /> Install
        </Button>
      </div>
    </div>
  )
}
