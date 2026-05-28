"use client"

import {AdminService, onSnapshot, where, query} from "@/src/services"
// app/(buyer)/dashboard/buyer/alerts/page.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, BellOff, Loader2, Search, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

export default function SavedAlertsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    const q = AdminService._ref_("searchAlerts", [where("userId", "==", user.uid)])
    return onSnapshot(q, snap => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [user?.uid])

  const handleDelete = async (alertId: string) => {
    setDeleting(alertId)
    try {
      await AdminService.deleteDoc("searchAlerts", alertId)
      toast({ title: "Alert removed", variant: "success" })
    } catch {
      toast({ title: "Could not remove alert", variant: "destructive" })
    } finally { setDeleting(null) }
  }

  const buildSearchUrl = (filters: Record<string, unknown>) => {
    const params = new URLSearchParams()
    if (filters.q)             params.set("q", String(filters.q))
    if (filters.category)      params.set("category", String(filters.category))
    if (filters.listingType)   params.set("type", String(filters.listingType))
    if (filters.condition)     params.set("condition", String(filters.condition))
    if (filters.nigerianState) params.set("state", String(filters.nigerianState))
    if (filters.minPrice)      params.set("min", String(Number(filters.minPrice) / 100))
    if (filters.maxPrice)      params.set("max", String(Number(filters.maxPrice) / 100))
    return `/search?${params.toString()}`
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" /> Search Alerts
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Get notified when new listings match your saved searches.
        </p>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Bell className="h-14 w-14 mx-auto text-muted-foreground/20" />
            <p className="font-semibold">No saved search alerts</p>
            <p className="text-sm text-muted-foreground">
              Go to search, set your filters, and click "Save Search" to get notified of new matches.
            </p>
            <Button asChild className="bg-primary text-white hover:bg-primary/90">
              <Link href="/search"><Search className="h-4 w-4 mr-2" /> Browse Listings</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <Card key={alert.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{alert.label}</p>

                  {/* Filter tags */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {alert.filters?.q && (
                      <Badge variant="secondary" className="text-xs">{alert.filters.q}</Badge>
                    )}
                    {alert.filters?.category && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {alert.filters.category.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {alert.filters?.nigerianState && (
                      <Badge variant="outline" className="text-xs">{alert.filters.nigerianState}</Badge>
                    )}
                    {alert.filters?.minPrice && (
                      <Badge variant="outline" className="text-xs">
                        From ₦{(alert.filters.minPrice / 100).toLocaleString()}
                      </Badge>
                    )}
                    {alert.filters?.maxPrice && (
                      <Badge variant="outline" className="text-xs">
                        To ₦{(alert.filters.maxPrice / 100).toLocaleString()}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-muted-foreground">
                      Created {alert.createdAt?.toDate
                        ? formatDistanceToNow(alert.createdAt.toDate(), { addSuffix: true })
                        : "recently"}
                    </p>
                    {alert.lastNotifiedAt && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Last match {formatDistanceToNow(alert.lastNotifiedAt.toDate(), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                    <Link href={buildSearchUrl(alert.filters || {})}>
                      <Search className="h-3 w-3 mr-1" /> View
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-red-500 hover:bg-red-50"
                    onClick={() => handleDelete(alert.id)}
                    disabled={deleting === alert.id}
                  >
                    {deleting === alert.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <><Trash2 className="h-3 w-3 mr-1" /> Remove</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
