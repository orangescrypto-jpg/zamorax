"use client"
// components/dashboard/SellerAnalyticsDashboard.tsx
// Seller analytics: views per listing, conversion rate, top performers

import { AdminService, orderBy, where } from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { formatPrice } from "@/lib/utils"
import { Eye, Heart, MessageSquare, TrendingUp, Star, Loader2, BarChart3, ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"

interface ListingStats {
  id: string
  title: string
  images: string[]
  views: number
  saves: number
  inquiries: number
  priceSale: number
  status: string
}

interface SellerAnalyticsDashboardProps {
  /** "basic" = Starter plan (summary stats + top 3 only)
   *  "full"  = Pro plan (everything) */
  tier?: "basic" | "full"
}

export function SellerAnalyticsDashboard({ tier = "full" }: SellerAnalyticsDashboardProps) {
  const { user } = useAuth()
  const [listings, setListings] = useState<ListingStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return }
    const fetch = async () => {
      try {
        // Order by createdAt (always indexed) then sort views client-side.
        // Avoids requiring a composite index on sellerId+views that may not exist.
        const docs = await AdminService.getCollection("listings", [
          where("sellerId", "==", user.uid),
          orderBy("createdAt", "desc"),
        ])
        const sorted = docs
          .map(d => ({ ...d } as ListingStats))
          .sort((a, b) => (b.views || 0) - (a.views || 0))
        setListings(sorted)
      } catch (err: any) {
        console.error("[SellerAnalyticsDashboard]", err)
        setError("Could not load analytics. Please refresh.")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [user?.uid])

  const totalViews     = listings.reduce((a, l) => a + (l.views || 0), 0)
  const totalSaves     = listings.reduce((a, l) => a + (l.saves || 0), 0)
  const totalInquiries = listings.reduce((a, l) => a + (l.inquiries || 0), 0)
  const conversionRate = totalViews > 0 ? ((totalInquiries / totalViews) * 100).toFixed(1) : "0"
  const topListings    = [...listings].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, tier === "basic" ? 3 : 5)
  const activeCount    = listings.filter(l => l.status === "active").length

  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-12 border border-dashed rounded-2xl text-center px-4">
      <BarChart3 className="h-8 w-8 text-muted-foreground opacity-30" />
      <p className="text-sm text-muted-foreground">{error}</p>
      <button onClick={() => window.location.reload()} className="text-xs text-primary underline">Refresh</button>
    </div>
  )

  if (listings.length === 0) return (
    <div className="text-center py-10 border border-dashed rounded-2xl">
      <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">No analytics yet. Post your first listing to see data.</p>
    </div>
  )

  const STAT_CARDS = [
    { label: "Total Views",       value: totalViews.toLocaleString(),     icon: Eye,           color: "text-blue-500",   bg: "bg-blue-500/10" },
    { label: "Saves / Wishlists", value: totalSaves.toLocaleString(),     icon: Heart,         color: "text-rose-500",   bg: "bg-rose-500/10" },
    { label: "Inquiries",         value: totalInquiries.toLocaleString(), icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    // Conversion rate is a Pro-only stat
    ...(tier === "full"
      ? [{ label: "Conversion Rate", value: `${conversionRate}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" }]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* Plan tier badge */}
      {tier === "basic" && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Basic Analytics</span> — upgrade to Pro for conversion rates, full top-5 breakdown &amp; reports.
          </p>
          <Link href="/pricing" className="text-xs font-semibold text-primary underline shrink-0 ml-3">Upgrade</Link>
        </div>
      )}
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top performing listings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-300" />
            Top Performing Listings {tier === "basic" ? "(Top 3)" : "(Top 5)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {topListings.map((listing, i) => {
              const ctr = listing.views > 0
                ? ((listing.inquiries / listing.views) * 100).toFixed(1)
                : "0"
              return (
                <div key={listing.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {/* Rank */}
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    i === 0 ? "bg-amber-100 text-amber-700"
                    : i === 1 ? "bg-gray-100 text-gray-600"
                    : i === 2 ? "bg-orange-100 text-orange-700"
                    : "bg-muted text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>

                  {/* Image */}
                  <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                    {listing.images?.[0] ? (
                      <Image src={listing.images[0]} alt={listing.title} width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{listing.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <Eye className="h-3 w-3" /> {listing.views || 0}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <Heart className="h-3 w-3" /> {listing.saves || 0}
                      </span>
                      <span className="text-[11px] text-emerald-600 font-medium">{ctr}% CTR</span>
                    </div>
                  </div>

                  {/* Price + link */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-semibold text-primary">{formatPrice(listing.priceSale || 0)}</span>
                    <Link href={`/dashboard/seller/listings/${listing.id}/edit`}>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary footer */}
      <p className="text-xs text-muted-foreground text-center">
        {activeCount} active listing{activeCount !== 1 ? "s" : ""} · {listings.length} total
      </p>
    </div>
  )
}
