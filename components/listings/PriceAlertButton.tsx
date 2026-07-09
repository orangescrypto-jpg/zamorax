"use client"

// components/listings/PriceAlertButton.tsx
// Allows buyers to set a price drop alert on a listing.
// Gated by settings.priceAlertsEnabled.

import { useState, useEffect } from "react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/useAuth"
import { useRouter, usePathname } from "next/navigation"
import { PriceAlertsService } from "@/src/services/priceAlerts"
import { formatPrice } from "@/lib/utils"
import type { Listing, PriceAlert } from "@/src/types"

interface Props {
  listing: Pick<Listing, "id" | "title" | "images" | "priceSale" | "sellerId">
}

export function PriceAlertButton({ listing }: Props) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()

  const [alert,       setAlert]       = useState<PriceAlert | null>(null)
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [checking,    setChecking]    = useState(true)
  const [targetInput, setTargetInput] = useState("")

  // Load existing alert on mount
  useEffect(() => {
    if (!user?.uid) { setChecking(false); return }
    PriceAlertsService.getAlert(user.uid, listing.id)
      .then((a) => { setAlert(a); setChecking(false) })
      .catch(() => setChecking(false))
  }, [user?.uid, listing.id])

  const handleOpen = () => {
    if (!isAuthenticated()) { router.push(`/login?next=${encodeURIComponent(pathname)}`); return }
    // Pre-fill with a slight reduction (5%)
    const suggestedTarget = Math.floor(listing.priceSale * 0.95)
    setTargetInput(String(Math.floor(suggestedTarget / 100))) // convert kobo → naira for input
    setOpen(true)
  }

  const handleSetAlert = async () => {
    if (!user?.uid) return
    const targetNaira = parseFloat(targetInput.replace(/,/g, ""))
    if (isNaN(targetNaira) || targetNaira <= 0) {
      toast({ title: "Enter a valid target price", variant: "destructive" })
      return
    }
    const targetKobo = Math.floor(targetNaira * 100)
    if (targetKobo >= listing.priceSale) {
      toast({ title: "Target must be lower than current price", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      await PriceAlertsService.setAlert(user.uid, listing.id, targetKobo, listing)
      const newAlert = await PriceAlertsService.getAlert(user.uid, listing.id)
      setAlert(newAlert)
      setOpen(false)
      toast({ title: "🔔 Alert set!", description: `We'll notify you when price drops below ${formatPrice(targetKobo)}`, variant: "success" })
    } catch {
      toast({ title: "Failed to set alert", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!user?.uid || !alert) return
    setLoading(true)
    try {
      await PriceAlertsService.cancelAlert(user.uid, listing.id)
      setAlert(null)
      toast({ title: "Alert cancelled" })
    } catch {
      toast({ title: "Failed to cancel alert", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  // Active alert — show cancel option
  if (alert?.status === "active") {
    return (
      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
        <Bell className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">
            Alert set for {formatPrice(alert.targetPrice)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            We'll notify you if price drops below this
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 shrink-0"
          onClick={handleCancel}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellOff className="h-3.5 w-3.5" />}
        </Button>
      </div>
    )
  }

  // No alert — show set button and optional form
  return (
    <div className="space-y-2">
      {!open ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs gap-2 border-dashed hover:border-primary/50 hover:text-primary hover:bg-primary/5"
          onClick={handleOpen}
        >
          <Bell className="h-3.5 w-3.5" />
          Notify me if price drops
        </Button>
      ) : (
        <div className="p-3 border border-primary/20 rounded-xl bg-primary/5 space-y-3">
          <p className="text-xs font-medium text-foreground flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            Set price drop alert
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Alert me when price drops below (₦)</Label>
            <Input
              type="number"
              min={1}
              placeholder={String(Math.floor(listing.priceSale / 100 * 0.9))}
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Current price: {formatPrice(listing.priceSale)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={handleSetAlert}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Set Alert
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
