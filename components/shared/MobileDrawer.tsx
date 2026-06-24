"use client"
// components/shared/MobileDrawer.tsx
// Reusable slide-in side drawer for mobile nav on all role layouts.
// Usage: wrap your sidebar content in <MobileDrawer> and pass a trigger button.

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileDrawerProps {
  /** The hamburger / menu button that opens the drawer */
  trigger: React.ReactNode
  /** The nav content to render inside the drawer */
  children: React.ReactNode
  /** Brand header shown at top of drawer */
  title?: string
  /** Accent line colour class e.g. "bg-primary" or "bg-secondary" */
  accentClass?: string
}

export function MobileDrawer({
  trigger,
  children,
  title = "Menu",
  accentClass = "bg-primary",
}: MobileDrawerProps) {
  const [open, setOpen] = useState(false)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* Trigger — clone and attach onClick */}
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger}
      </span>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-[70] h-full w-72 max-w-[85vw] bg-background shadow-2xl",
          "transform transition-transform duration-300 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Accent top bar */}
        <div className={cn("h-1 w-full", accentClass)} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <span className="font-heading font-bold text-lg text-secondary">{title}</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Nav content — scrollable */}
        <div className="overflow-y-auto h-[calc(100%-4.5rem)] pb-8">
          {children}
        </div>
      </aside>
    </>
  )
}
