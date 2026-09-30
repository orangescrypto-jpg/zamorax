"use client"
// components/layout/CategoryTabBar.tsx
//
// Sticky horizontal category strip pinned directly under the fixed Navbar
// (like Shein's top nav). Stays visible while the page scrolls.
//
// "There's more" affordances so people don't have to guess the strip swipes:
//   • Edge fades + round arrow buttons (appear only in the direction that
//     still has categories; tap to glide ~70% of the strip)
//   • A one-time gentle auto-nudge on first visit of a session
//   • The right arrow softly pulses until the user has scrolled once
//
// NOTE: position:sticky only works if no ancestor is a scroll container.
// globals.css uses `overflow-x: clip` on html/body for that reason — do not
// change it back to `hidden`.

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getActiveHomepageCategories } from "@/constants/categories"
import { useSubSettings } from "@/hooks/useSubSettings"
import { cn } from "@/lib/utils"

const NAVBAR_HEIGHT = 64 // must match h-16 in Navbar.tsx
const NUDGE_KEY = "zx_cat_nudged"

export function CategoryTabBar() {
  const pathname = usePathname()
  const barRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  const [stuck, setStuck] = useState(false)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  const { settings } = useSubSettings()
  const homepageCategories = getActiveHomepageCategories(
    settings.disabledCategorySlugs,
    settings.categoryOrder,
    settings.homepageOverrideSlugs
  )

  const activeSlug = pathname.startsWith("/categories/")
    ? pathname.split("/categories/")[1]?.split("/")[0]
    : null

  // Shadow only appears once the bar is actually pinned under the navbar.
  useEffect(() => {
    const onScroll = () => {
      const top = barRef.current?.getBoundingClientRect().top ?? NAVBAR_HEIGHT
      setStuck(top <= NAVBAR_HEIGHT + 0.5 && window.scrollY > 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Which directions still have hidden categories?
  const updateEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateEdges()
    window.addEventListener("resize", updateEdges)
    return () => window.removeEventListener("resize", updateEdges)
  }, [updateEdges, homepageCategories.length])

  // Bring the active category into view horizontally (no page scroll).
  useEffect(() => {
    const el = scrollRef.current
    const a = activeRef.current
    if (!el || !a) return
    el.scrollTo({
      left: a.offsetLeft - el.clientWidth / 2 + a.clientWidth / 2,
      behavior: "smooth",
    })
  }, [activeSlug])

  // One-time gentle nudge: glide right a little, then back — a visual
  // "swipe me" hint. Once per session, skipped for reduced-motion users
  // and when an active category is already being centred.
  useEffect(() => {
    if (activeSlug || homepageCategories.length === 0) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    try {
      if (sessionStorage.getItem(NUDGE_KEY)) return
    } catch {}
    const el = scrollRef.current
    if (!el) return
    const t1 = setTimeout(() => {
      if (el.scrollWidth <= el.clientWidth + 8) return
      try { sessionStorage.setItem(NUDGE_KEY, "1") } catch {}
      el.scrollTo({ left: 110, behavior: "smooth" })
      setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 750)
    }, 1200)
    return () => clearTimeout(t1)
  }, [activeSlug, homepageCategories.length])

  const slide = (dir: 1 | -1) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" })
  }

  return (
    <div
      ref={barRef}
      className={cn(
        "sticky top-16 z-40 border-b transition-shadow duration-200",
        "bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80",
        stuck ? "border-border/60 shadow-md" : "border-border/40 shadow-none"
      )}
    >
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={() => {
            updateEdges()
            if (!hasScrolled) setHasScrolled(true)
          }}
          className="container flex items-center gap-2 overflow-x-auto py-2.5 no-scrollbar scroll-smooth"
        >
          {homepageCategories.map(cat => {
            const isActive = cat.slug === activeSlug
            return (
              <Link
                key={cat.id}
                ref={isActive ? activeRef : undefined}
                href={`/categories/${cat.slug}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap border",
                  "transition-all duration-150 active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white text-secondary/80 border-border/60 hover:bg-muted hover:text-secondary hover:border-border"
                )}
              >
                {cat.name}
              </Link>
            )
          })}
          {/* trailing space so the last pill clears the right arrow */}
          <span aria-hidden className="shrink-0 w-8" />
        </div>

        {/* Left fade + arrow */}
        <div
          aria-hidden={!canLeft}
          className={cn(
            "absolute inset-y-0 left-0 flex items-center pl-1 pr-6 transition-opacity duration-200",
            "bg-gradient-to-r from-white via-white/90 to-transparent",
            canLeft ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <button
            type="button"
            tabIndex={canLeft ? 0 : -1}
            onClick={() => slide(-1)}
            aria-label="Scroll categories left"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-secondary shadow-md ring-1 ring-border/60 active:scale-90 transition-transform"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Right fade + arrow (pulses until the strip has been scrolled) */}
        <div
          aria-hidden={!canRight}
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end pr-1 pl-6 transition-opacity duration-200",
            "bg-gradient-to-l from-white via-white/90 to-transparent",
            canRight ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <button
            type="button"
            tabIndex={canRight ? 0 : -1}
            onClick={() => slide(1)}
            aria-label="Scroll categories right"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-90 transition-transform",
              !hasScrolled && "animate-pulse"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
