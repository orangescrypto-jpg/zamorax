"use client"

import { useInstallPrompt } from "@/hooks/usePWA"
import { Download, X } from "lucide-react"
import { useState } from "react"

export default function InstallBanner() {
  const { canInstall, install } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  if (!canInstall || dismissed) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-24 sm:w-80 z-40 bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Install Zamorax App</p>
        <p className="text-xs text-muted-foreground">Add to your home screen for faster access</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={install}
          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          Install
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
