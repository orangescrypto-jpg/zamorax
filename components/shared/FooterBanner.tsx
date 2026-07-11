"use client"
// components/shared/FooterBanner.tsx
// Normal-sized promo/CTA banner shown above the site footer, admin-managed
// via /admin/site-banners (placement = "footer"). Renders null whenever
// there's no active banner — never leaves an empty gap.

import { AdminService, where, orderBy, query, onSnapshot } from "@/src/services"
import { useEffect, useState } from "react"
import Link from "next/link"

interface SiteBanner {
  id: string
  placement: "header" | "footer"
  title?: string
  subtitle?: string
  ctaLabel?: string
  href?: string
  imageUrl?: string
  bgColor?: string
  textColor?: string
  active: boolean
  order: number
}

export function FooterBanner() {
  const [banner, setBanner] = useState<SiteBanner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = AdminService._ref_("siteBanners", [
      where("placement", "==", "footer"),
      where("active", "==", true),
      orderBy("order", "asc"),
    ])
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map((d: { id: string; data: () => Record<string, unknown> }) => ({ id: d.id, ...d.data() } as SiteBanner))
      setBanner(docs[0] ?? null)
      setLoading(false)
    })
    return unsub
  }, [])

  if (loading || !banner) return null

  const bg   = banner.bgColor   || "#FF6B00"
  const text = banner.textColor || "#FFFFFF"

  const inner = (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left"
      style={{ backgroundColor: bg, color: text }}
    >
      {banner.imageUrl && (
        <img
          src={banner.imageUrl}
          alt=""
          className="hidden sm:block h-24 w-24 object-contain shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        {banner.title && <h3 className="text-xl sm:text-2xl font-extrabold mb-1">{banner.title}</h3>}
        {banner.subtitle && <p className="opacity-90 text-sm sm:text-base">{banner.subtitle}</p>}
      </div>
      {banner.ctaLabel && (
        <span
          className="shrink-0 inline-flex items-center justify-center px-6 py-3 rounded-full font-semibold text-sm bg-white/95 hover:bg-white transition-colors"
          style={{ color: bg }}
        >
          {banner.ctaLabel}
        </span>
      )}
    </div>
  )

  return (
    <div className="container py-6">
      {banner.href ? (
        <Link href={banner.href} className="block">{inner}</Link>
      ) : inner}
    </div>
  )
}
