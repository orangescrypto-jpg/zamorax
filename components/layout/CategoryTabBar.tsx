"use client"
// components/layout/CategoryTabBar.tsx
//
// Sticky horizontal category strip pinned directly under the fixed Navbar
// (like Shein's top nav). It stays visible while the page scrolls, so
// switching categories never needs a scroll back to the top.
//
// NOTE: position:sticky only works if no ancestor is a scroll container.
// globals.css uses `overflow-x: clip` on html/body for that reason — do not
// change it back to `hidden`.

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { getActiveHomepageCategories } from "@/constants/categories"
import { useSubSettings } from "@/hooks/useSubSettings"
import { cn } from "@/lib/utils"

const NAVBAR_HEIGHT = 64 // must match h-16 in Navbar.tsx

export function CategoryTabBar() {
  const pathname = usePathname()
  const barRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)
  const [stuck, setStuck] = useState(false)
  const [atEnd, setAtEnd] = useState(false)
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

  // Hide the right-edge fade once the strip is scrolled to its end.
  const updateEnd = () => {
    const el = scrollRef.current
    if (!el) return
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }
  useEffect(() => {
    updateEnd()
    window.addEventListener("resize", updateEnd)
    return () => window.removeEventListener("resize", updateEnd)
  }, [homepageCategories.length])

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
          onScroll={updateEnd}
          className="container flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar scroll-smooth"
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
                  "shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap",
                  "transition-all duration-150 active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-secondary/80 hover:bg-muted hover:text-secondary"
                )}
              >
                {cat.name}
              </Link>
            )
          })}
        </div>
        {/* Right-edge fade hints that the strip scrolls sideways */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent",
            "transition-opacity duration-200",
            atEnd ? "opacity-0" : "opacity-100"
          )}
        />
      </div>
    </div>
  )
}
