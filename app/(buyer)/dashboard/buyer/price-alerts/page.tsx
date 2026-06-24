"use client"

// app/(buyer)/dashboard/buyer/price-alerts/page.tsx
// Shows all active price drop alerts for the logged-in buyer.
// Uses PriceAlertsService — no direct Firestore imports.

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { PriceAlertsService } from "@/src/services/priceAlerts"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, BellOff, Loader2, Tag, ArrowRight } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"
import type { PriceAlert } from "@/src/types"

export default function PriceAlertsPage() {
  const { user }    = useAuth()
  const { toast }   = useToast()
  const { settings } = usePlatformSettings()

  const [alerts,    setAlerts]    = useState<PriceAlert[]>([])
  const [loading,   setLoading]   = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    PriceAlertsService.getUserAlerts(user.uid)
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.uid])

  const handleCancel = async (alert: PriceAlert) => {
    if (!user?.uid) return
    setCancelling(alert.listingId)
    try {
      await PriceAlertsService.cancelAlert(user.uid, alert.listingId)
      setAlerts(prev => prev.filter(a => a.listingId !== alert.listingId))
      toast({ title: "Alert cancelled" })
    } catch {
      toast({ title: "Error cancelling alert", variant: "destructive" })
    } finally {
      setCancelling(null)
    }
  }

  if (!settings.priceAlertsEnabled) {
    return (
      <div className="container max-w-2xl py-16 text-center space-y-4">
        <Bell className="h-10 w-10 mx-auto text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Price alerts are currently disabled.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Price Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Get notified when a listing drops below your target price.
          </p>
        </div>
        {alerts.length > 0 && (
          <Badge variant="outline" className="gap-1">
            <Bell className="h-3.5 w-3.5" /> {alerts.length} active
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Bell className="h-9 w-9 text-muted-foreground opacity-40" />
          </div>
          <div>
            <p className="font-semibold">No active price alerts</p>
            <p className="text-sm text-muted-foreground mt-1">
              Browse listings and tap "Notify me if price drops" to set an alert.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/search">Browse Listings</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <Card key={alert.listingId} className="overflow-hidden">
              <CardContent className="p-4 flex items-start gap-4">
                {/* Listing image */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                  {alert.listingImage ? (
                    <Image
                      src={alert.listingImage}
                      alt={alert.listingTitle}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Tag className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Link
                    href={`/listings/${alert.listingId}`}
                    className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors group flex items-center gap-1"
                  >
                    {alert.listingTitle}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>
                      Current: <span className="font-semibold text-foreground">{formatPrice(alert.currentPrice)}</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <span className="flex items-center gap-1">
                      <Bell className="h-3 w-3 text-primary" />
                      Alert at: <span className="font-semibold text-primary">{formatPrice(alert.targetPrice)}</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                      {Math.round((1 - alert.targetPrice / alert.currentPrice) * 100)}% drop
                    </Badge>
                  </div>
                </div>

                {/* Cancel */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleCancel(alert)}
                  disabled={cancelling === alert.listingId}
                  title="Cancel alert"
                >
                  {cancelling === alert.listingId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
