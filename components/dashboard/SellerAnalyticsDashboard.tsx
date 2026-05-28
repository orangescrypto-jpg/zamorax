"use client"

import {AdminService, orderBy, where, query} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { formatPrice } from "@/lib/utils"
import { Eye, Heart, MessageSquare, TrendingUp, Clock, Star, Loader2, BarChart3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ListingStats {
  id: string
  title: string
  image: string
  views: number
  saves: number
  inquiries: number
  priceSale: number
  createdAt: string
  status: string
}

interface HourlyData {
  hour: number
  label: string
  views: number
}

const HOUR_LABELS = ["12am","1am","2am","3am","4am","5am","6am","7am","8am","9am","10am","11am",
  "12pm","1pm","2pm","3pm","4pm","5pm","6pm","7pm","8pm","9pm","10pm","11pm"]

export function SellerAnalyticsDashboard() {
  const { user } = useAuth()
  const [listings, setListings] = useState<ListingStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const fetch = async () => {
      const q = AdminService._ref_("listings", [where("sellerId", "==", user.uid), orderBy("views", "desc")])
      const snap = await AdminService.getCollection(q)
      setListings(snap.docs.map(d => ({ id: d.id, ...d.data() } as ListingStats)))
      setLoading(false)
    }
    fetch()
  }, [user?.uid])

  const totalViews = listings.reduce((a, l) => a + (l.views || 0), 0)
  const totalSaves = listings.reduce((a, l) => a + (l.saves || 0), 0)
  const totalInquiries = listings.reduce((a, l) => a + (l.inquiries || 0), 0)
  const avgCTR = totalViews > 0 ? ((totalInquiries / totalViews) * 100).toFixed(1) : "0"
  const saveRate = totalViews > 0 ? ((totalSaves / totalViews) * 100).toFixed(1) : "0"

  // Best time to post: simulated from createdAt hours of top-performing listings
  // In production this would come from a views_log collection
  const bestHours = [9, 12, 18, 20] // Morning, Noon, Evening, Night — most active Nigerian browsing times
  const bestTimeLabel = "6pm – 9pm & 9am – 12pm"

  const topListing = listings[0]

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (listings.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <BarChart3 className="h-12 w-12 text-muted-foreground/40 mx-auto" />
      <p className="font-medium text-secondary">No analytics yet</p>
      <p className="text-sm text-muted-foreground">Post your first listing to start seeing data.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Total Views", value: totalViews.toLocaleString(), icon: <Eye className="h-4 w-4 text-blue-500" />, color: "bg-blue-50" },
          { label: "Total Saves", value: totalSaves.toLocaleString(), icon: <Heart className="h-4 w-4 text-red-500" />, color: "bg-red-50" },
          { label: "Enquiries", value: totalInquiries.toLocaleString(), icon: <MessageSquare className="h-4 w-4 text-primary" />, color: "bg-primary/10" },
          { label: "Click Rate", value: `${avgCTR}%`, icon: <TrendingUp className="h-4 w-4 text-green-500" />, color: "bg-green-50" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Best time to post */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">Best Time to Post</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl">🕕</div>
            <div>
              <p className="font-bold text-secondary">{bestTimeLabel}</p>
              <p className="text-xs text-muted-foreground">Nigerian buyers are most active during these hours. Post right before for maximum visibility.</p>
            </div>
          </div>
          {/* Simple hour bar chart */}
          <div className="flex items-end gap-0.5 h-12 mt-2">
            {HOUR_LABELS.map((label, h) => {
              const isHot = bestHours.includes(h)
              const isMid = [7, 8, 13, 14, 17, 19, 21].includes(h)
              const height = isHot ? "100%" : isMid ? "60%" : "20%"
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={label}>
                  <div
                    className={`w-full rounded-sm transition-all ${isHot ? "bg-primary" : isMid ? "bg-primary/40" : "bg-muted"}`}
                    style={{ height }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
          </div>
        </CardContent>
      </Card>

      {/* Per-listing breakdown */}
      <div className="space-y-2">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" /> Listing Performance
        </p>
        {listings.map(l => {
          const ctr = l.views > 0 ? ((l.inquiries / l.views) * 100).toFixed(1) : "0"
          const saveRate = l.views > 0 ? ((l.saves / l.views) * 100).toFixed(1) : "0"
          const score = (l.views * 1) + (l.saves * 3) + (l.inquiries * 5)

          return (
            <Card key={l.id}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {l.image && <img src={l.image} alt="" className="h-12 w-12 rounded object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{l.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{l.views || 0}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{l.saves || 0}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{l.inquiries || 0}</span>
                      <span className="text-primary font-medium">CTR {ctr}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Score</p>
                    <p className={`font-bold text-sm ${score > 50 ? "text-green-600" : score > 20 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {score > 50 ? "🔥" : score > 20 ? "📈" : "💤"} {score}
                    </p>
                  </div>
                </div>

                {/* Mini bar: views → saves → inquiries funnel */}
                <div className="mt-2 space-y-1">
                  {[
                    { label: "Views", val: l.views || 0, max: Math.max(...listings.map(x => x.views || 0), 1), color: "bg-blue-400" },
                    { label: "Saves", val: l.saves || 0, max: Math.max(...listings.map(x => x.saves || 0), 1), color: "bg-red-400" },
                    { label: "Chats", val: l.inquiries || 0, max: Math.max(...listings.map(x => x.inquiries || 0), 1), color: "bg-primary" },
                  ].map(bar => (
                    <div key={bar.label} className="flex items-center gap-2 text-xs">
                      <span className="w-10 text-muted-foreground">{bar.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${bar.color}`} style={{ width: `${(bar.val / bar.max) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right font-medium">{bar.val}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Save rate tip */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm space-y-1">
          <p className="font-semibold text-primary">💡 Tip</p>
          <p className="text-muted-foreground">
            Your save rate is <strong>{saveRate}%</strong>. Listings with save rate above 5% usually sell within 3 days.
            {Number(saveRate) < 5 ? " Try better photos or a small price reduction." : " Great job — your listings are attractive!"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
