"use client"

// components/home/RecentlyViewedRow.tsx
//
// Homepage "Recently Viewed" row — device-local (see lib/recentlyViewedLocal.ts):
//   • Read from THIS browser's localStorage, not the account — works for
//     guests too, no login required.
//   • Every category mixed into one strip, most-recently-viewed first —
//     matches how someone actually browses (a bag of garri next to a phone
//     case is normal here).
//   • Cards are short on purpose — image, one line of title, price. No
//     badges, no seller row, nothing that makes this row compete with the
//     full-size listing cards elsewhere on the page.
//   • Slides both on its own (autoplay) and by hand (swipe or the arrows) —
//     same rhythm as FreeDeliverySection.
//
// Gated on subSettings.recentlyViewedLocalEnabled / …LocalCount, set at
// /admin/sub-settings. This is separate from the older, account+server
// recentlyViewedEnabled toggle in platformSettings.ts.

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { useSubSettings } from "@/hooks/useSubSettings"
import { getRecentlyViewedLocal } from "@/lib/recentlyViewedLocal"
import { formatPrice } from "@/lib/utils"
import type { RecentlyViewedLocalItem } from "@/lib/recentlyViewedLocal"

const AUTOPLAY_MS = 3000
const RESUME_DELAY_MS = 4000

export function RecentlyViewedRow() {
  const { settings } = useSubSettings()
  const count = settings.recentlyViewedLocalCount || 10
  const [items, setItems] = useState<RecentlyViewedLocalItem[]>([])
  const [loaded, setLoaded] = useState(false)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)
  const [scrollPct, setScrollPct] = useState(0)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(false)

  // Reads localStorage — client-only, so this runs after mount.
  useEffect(() => {
    if (!settings.recentlyViewedLocalEnabled) { setLoaded(true); return }
    setItems(getRecentlyViewedLocal(count))
    setLoaded(true)
  }, [settings.recentlyViewedLocalEnabled, count])

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScroll(maxScroll > 4)
    setScrollPct(maxScroll > 4 ? Math.min(1, Math.max(0, el.scrollLeft / maxScroll)) : 0)
  }, [])

  useEffect(() => {
    updateScrollState()
    window.addEventListener("resize", updateScrollState)
    return () => window.removeEventListener("resize", updateScrollState)
  }, [updateScrollState, items])

  const scrollByCards = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>("[data-rv-card]")
    const step = card ? card.offsetWidth + 12 : el.clientWidth * 0.4
    el.scrollBy({ left: dir * step, behavior: "smooth" })
  }, [])

  // Autoplay — one card at a time, loops back to the start at the end.
  useEffect(() => {
    if (!canScroll) return
    autoplayRef.current = setInterval(() => {
      if (pausedRef.current) return
      const el = scrollerRef.current
      if (!el) return
      const maxScroll = el.scrollWidth - el.clientWidth
      if (el.scrollLeft >= maxScroll - 4) {
        el.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        scrollByCards(1)
      }
    }, AUTOPLAY_MS)
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current) }
  }, [canScroll, items.length, scrollByCards])

  const pauseAutoplay = useCallback(() => {
    pausedRef.current = true
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => { pausedRef.current = false }, RESUME_DELAY_MS)
  }, [])

  useEffect(() => {
    return () => { if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current) }
  }, [])

  if (!settings.recentlyViewedLocalEnabled) return null
  if (!loaded || items.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Recently Viewed</h2>
        </div>
        {canScroll && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => { pauseAutoplay(); scrollByCards(-1) }}
              disabled={scrollPct <= 0.02}
              className="h-6 w-6 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => { pauseAutoplay(); scrollByCards(1) }}
              disabled={scrollPct >= 0.98}
              className="h-6 w-6 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        onScroll={updateScrollState}
        onTouchStart={pauseAutoplay}
        onMouseDown={pauseAutoplay}
        onWheel={pauseAutoplay}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {items.map(item => (
          <Link
            key={item.listingId}
            data-rv-card
            href={`/listings/${item.listingId}`}
            className="shrink-0 w-24 snap-start group"
          >
            <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted mb-1">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="96px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="text-[11px] font-medium text-foreground truncate leading-snug group-hover:text-primary transition-colors">
              {item.title}
            </p>
            {item.originalPrice ? (
              <p className="flex items-baseline gap-1 flex-wrap">
                <span className="text-[11px] font-bold text-primary">
                  {formatPrice(item.priceSale)}
                </span>
                <span className="text-[10px] text-muted-foreground line-through">
                  {formatPrice(item.originalPrice)}
                </span>
              </p>
            ) : (
              <p className="text-[11px] font-bold text-primary">
                {formatPrice(item.priceSale)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}
