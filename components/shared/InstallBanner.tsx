"use client"

// components/shared/InstallBanner.tsx
// Shows a single "Install" button with a short line of text.
// - Android / Chrome: the button opens the native install prompt.
// - iOS and browsers with no native prompt: the button opens a short
//   how-to sheet, because those browsers cannot be installed any other way.
// Steps are never shown up front.

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Download, X, Share, Plus } from "lucide-react"
import { useInstallPrompt } from "@/hooks/usePWA"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

const BANNER_TEXT = "For quick access, click to install Zamorax"

export default function InstallBanner() {
  const { settings } = usePlatformSettings()
  const pathname = usePathname()
  const { canInstall, isInstalled, isIOS, isMobile, canShow, install, dismiss } = useInstallPrompt()

  const [visible, setVisible] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)

  // Dashboard / admin / moderator routes: never show
  const isHidden =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/moderator")

  useEffect(() => {
    if (!settings.pwaInstallPromptEnabled || isInstalled || isHidden) return
    if (!canShow(settings.pwaReshowAfterDismissSec ?? 86400)) return

    const delay = (settings.pwaInstallPromptDelaySec ?? 0) * 1000
    const t = setTimeout(() => {
      // Show the bar when the native prompt is ready, or on any mobile
      // browser (iOS, Firefox, Chrome after the one-time prompt was used).
      if (canInstall || isMobile || isIOS) setVisible(true)
    }, delay)

    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.pwaInstallPromptEnabled,
    settings.pwaInstallPromptDelaySec,
    settings.pwaReshowAfterDismissSec,
    isInstalled, canInstall, isIOS, isMobile, isHidden,
  ])

  const handleDismiss = () => {
    dismiss()
    setVisible(false)
    setStepsOpen(false)
  }

  const handleInstall = async () => {
    if (canInstall) {
      await install()
      setVisible(false)
      return
    }
    // No native prompt available: show the steps, only now.
    setStepsOpen(true)
  }

  if (isInstalled || !visible) return null

  return (
    <>
      <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[200] bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <p className="flex-1 min-w-0 text-sm font-medium text-foreground leading-snug">
          {BANNER_TEXT}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleInstall}
            className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steps: only after the person taps Install on a browser with no native prompt */}
      {stepsOpen && (
        <>
          <div className="fixed inset-0 z-[201] bg-black/40 backdrop-blur-sm" onClick={() => setStepsOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[202] bg-card rounded-t-3xl shadow-2xl p-6 pb-8 animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-foreground">
                {isIOS ? "Install on iPhone or iPad" : "Install Zamorax"}
              </p>
              <button
                onClick={() => setStepsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-foreground flex items-center gap-1.5">
                    Tap the <strong>Share</strong> button <Share className="w-4 h-4 text-blue-500" />
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-foreground flex items-center gap-1.5">
                    Tap <strong>Add to Home Screen</strong> <Plus className="w-4 h-4 text-blue-500" />
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p className="text-sm text-foreground">Tap <strong>Add</strong></p>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-foreground">Open your browser menu</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-foreground">Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></p>
                </li>
              </ol>
            )}
          </div>
        </>
      )}
    </>
  )
}
