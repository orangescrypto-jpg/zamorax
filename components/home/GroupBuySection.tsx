"use client"

// components/home/GroupBuySection.tsx
// Homepage teaser for Group Buy — surfaces currently-open group buys so
// buyers can discover the feature without already knowing /group-buy
// exists. Same data source as app/(public)/group-buy/page.tsx (the
// "groupBuys" collection via AdminService, status == "open") but trimmed
// to a compact horizontal row. Gated on settings.groupBuyEnabled, the
// same master toggle the dedicated page and per-listing widget use.
// Renders nothing while loading or if there are no open groups, same
// as ZamoraxDirectSection / FeaturedListings.

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { AdminService, onSnapshot, where } from "@/src/services"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { formatPrice } from "@/lib/utils"
import { Users, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { Listing } from "@/src/types"

interface GroupBuyDoc {
  id: string
  listingId: string
  listingTitle?: string
  listingImage?: string
  originalPrice?: number
  groupPrice?: number
  members: string[]
  status: string
  [key: string]: unknown
}

const MAX_SHOWN = 6

export function GroupBuySection() {
  const { settings } = usePlatformSettings()
  const [groups, setGroups] = useState<GroupBuyDoc[]>([])
  const [loading, setLoading] = useState(true)

  const GROUP_SIZE = settings.groupBuyMinParticipants ?? 5

  useEffect(() => {
    if (!settings.groupBuyEnabled) { setLoading(false); return }

    const q = AdminService._ref_("groupBuys", [where("status", "==", "open")])
    const unsub = onSnapshot(q, (snap: any) => {
      const raw: GroupBuyDoc[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      setGroups(raw.slice(0, MAX_SHOWN))
      setLoading(false)
    }, () => setLoading(false))

    return () => unsub()
  }, [settings.groupBuyEnabled])

  if (!settings.groupBuyEnabled) return null
  if (loading || groups.length === 0) return null

  return (
    <section>
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="p-1.5 bg-green-50 rounded-lg shrink-0">
            <Users className="h-4 w-4 text-green-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <h2 className="text-base font-bold text-foreground truncate">
                Group Buy
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 rounded px-1.5 py-0.5 shrink-0">
                {settings.groupBuyDiscountPercent ?? 15}% off
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Team up with other buyers to unlock a lower price</p>
          </div>
        </div>
        <Link href="/group-buy" className="text-xs text-primary font-medium flex items-center gap-0.5 shrink-0 whitespace-nowrap">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {groups.map(g => {
          const membersCount = g.members?.length ?? 0
          const spotsLeft = Math.max(GROUP_SIZE - membersCount, 0)
          const pct = Math.min((membersCount / GROUP_SIZE) * 100, 100)

          return (
            <Link
              key={g.id}
              href={`/group-buy/${g.id}`}
              className="group flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden transition-all hover:shadow-md hover:border-primary/30"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <Image
                  src={g.listingImage || "/placeholder-listing.jpg"}
                  alt={g.listingTitle || "Group buy item"}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, 25vw"
                  loading="lazy"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-sm shadow-sm">
                  {settings.groupBuyDiscountPercent ?? 15}% off
                </span>
              </div>

              <div className="flex flex-col flex-1 p-2 sm:p-3 gap-1.5">
                <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {g.listingTitle || "Group buy item"}
                </h3>

                <div className="space-y-0.5">
                  {typeof g.groupPrice === "number" && (
                    <p className="text-base font-bold text-green-700 truncate">
                      {formatPrice(g.groupPrice)}
                    </p>
                  )}
                  {typeof g.originalPrice === "number" && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatPrice(g.originalPrice)}
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-1 space-y-1">
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{membersCount}/{GROUP_SIZE} joined</span>
                    <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
                      {spotsLeft} left
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
