"use client"

// components/shared/InstallBanner.tsx
// Replaces both the old InstallBanner AND components/layout/InstallPrompt.tsx
// NOTE: You can safely DELETE components/layout/InstallPrompt.tsx — it is fully replaced here.

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Download, X, Share, Plus } from "lucide-react"
import { useInstallPrompt } from "@/hooks/usePWA"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

export default function InstallBanner() {
  const { settings } = usePlatformSettings()
  const pathname     = usePathname()
  const { canInstall, isInstalled, isIOS, isMobile, canShow, install, dismiss } = useInstallPrompt()

  const [visible, setVisible]   = useState(false)
  const [iosOpen, setIosOpen]   = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  // Dashboard / admin / moderator routes — never show
  const isHidden = pathname?.startsWith("/dashboard") ||
                   pathname?.startsWith("/admin") ||
                   pathname?.startsWith("/moderator")

  useEffect(() => {
    if (
      !settings.pwaInstallPromptEnabled ||
      isInstalled ||
      isHidden
    ) return

    if (!canShow(settings.pwaReshowAfterDismissSec ?? 86400)) return

    // Show after configured delay
    const delay = (settings.pwaInstallPromptDelaySec ?? 0) * 1000
    const t = setTimeout(() => {
      if (isIOS) {
        setIosOpen(true)
      } else if (canInstall) {
        setVisible(true)
      } else if (isMobile) {
        // Android/other mobile browser where beforeinstallprompt either
        // hasn't fired yet or won't fire again this session (Chrome only
        // fires it once per browser profile until dismissed/reset) — show
        // manual "how to install" instructions instead of nothing, so the
        // prompt keeps reappearing on schedule per pwaReshowAfterDismissSec
        // rather than silently disappearing forever for these users.
        setManualOpen(true)
      }
    }, delay)

    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pwaInstallPromptEnabled, settings.pwaInstallPromptDelaySec,
      settings.pwaReshowAfterDismissSec, isInstalled, canInstall, isIOS, isMobile, isHidden])

  const handleDismiss = () => {
    dismiss()
    setVisible(false)
    setIosOpen(false)
    setManualOpen(false)
  }

  const headline = settings.pwaHeadline || "Install Zamorax App"
  const subtitle = settings.pwaSubtitle || "Add to home screen for faster access"

  // Already installed — nothing to show
  if (isInstalled) return null

  // ── Android / Chrome floating banner ──────────────────────────────────────
  if (visible && canInstall && !isIOS) {
    return (
      <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-[200] bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{headline}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={async () => { await install(); setVisible(false) }}
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
    )
  }

  // ── iOS bottom sheet modal ─────────────────────────────────────────────────
  if (iosOpen && isIOS) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[199] bg-black/40 backdrop-blur-sm"
          onClick={handleDismiss}
        />
        {/* Sheet */}
        <div className="fixed bottom-0 left-0 right-0 z-[200] bg-card rounded-t-3xl shadow-2xl p-6 pb-8 animate-in slide-in-from-bottom-full duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{headline}</p>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">How to install on iPhone / iPad:</p>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div className="flex-1">
                  <p className="text-sm text-foreground">Tap the <strong>Share</strong> button</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Share className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">at the bottom of your browser</span>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div className="flex-1">
                  <p className="text-sm text-foreground">Scroll down and tap <strong>Add to Home Screen</strong></p>
                  <div className="flex items-center gap-1 mt-1">
                    <Plus className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">you may need to scroll in the share menu</span>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <p className="text-sm text-foreground">Tap <strong>Add</strong> to confirm</p>
              </li>
            </ol>
          </div>

          <button
            onClick={handleDismiss}
            className="mt-5 w-full py-3 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </>
    )
  }

  // ── Manual fallback sheet — Android/other mobile browsers where the
  // native beforeinstallprompt isn't available on this load ─────────────────
  if (manualOpen && isMobile && !isIOS) {
    return (
      <>
        <div
          className="fixed inset-0 z-[199] bg-black/40 backdrop-blur-sm"
          onClick={handleDismiss}
        />
        <div className="fixed bottom-0 left-0 right-0 z-[200] bg-card rounded-t-3xl shadow-2xl p-6 pb-8 animate-in slide-in-from-bottom-full duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{headline}</p>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">How to install:</p>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <p className="text-sm text-foreground">Tap your browser's <strong>menu</strong> button (usually ⋮ or ☰)</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p className="text-sm text-foreground">Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></p>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <p className="text-sm text-foreground">Confirm to add Zamorax to your home screen</p>
              </li>
            </ol>
          </div>

          <button
            onClick={handleDismiss}
            className="mt-5 w-full py-3 rounded-xl text-sm text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </>
    )
  }

  return null
}
