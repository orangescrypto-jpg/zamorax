"use client"
// components/listings/BackInStockAlert.tsx
// backInStockAlertsEnabled + maxBackInStockPerUser from config/platform.

import { AdminService, serverTimestamp } from "@/src/services"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { where } from "@/src/services"

interface BackInStockAlertProps {
  listingId: string
  listingTitle: string
  sellerId: string
  listingStatus: string
}

export function BackInStockAlert({ listingId, listingTitle, sellerId, listingStatus }: BackInStockAlertProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { settings } = usePlatformSettings()

  const [isAlerted, setIsAlerted] = useState(false)
  const [loading, setLoading] = useState(true)

  const isUnavailable = ["sold", "rented", "paused", "suspended"].includes(listingStatus)

  useEffect(() => {
    if (!user?.uid || !isUnavailable) { setLoading(false); return }
    AdminService.getDoc("stockAlerts", `${user.uid}_${listingId}`)
      .then(snap => setIsAlerted(!!snap))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.uid, listingId, isUnavailable])

  // ── Gate: admin disabled back-in-stock alerts ─────────────────────────────
  if (!isUnavailable || !settings.backInStockAlertsEnabled) return null

  const handleToggle = async () => {
    if (!user?.uid) { router.push("/login"); return }
    setLoading(true)

    try {
      if (isAlerted) {
        await AdminService.deleteDoc("stockAlerts", `${user.uid}_${listingId}`)
        setIsAlerted(false)
        toast({ title: "Alert removed", description: "You won't be notified about this listing." })
      } else {
        // Check per-user limit
        const existing = await AdminService.getCollection("stockAlerts", [
          where("userId", "==", user.uid)
        ])
        if (existing.length >= settings.maxBackInStockPerUser) {
          toast({
            title: "Alert limit reached",
            description: `You can track up to ${settings.maxBackInStockPerUser} items. Remove one to add another.`,
            variant: "destructive",
          })
          setLoading(false)
          return
        }

        await AdminService.setDoc("stockAlerts", `${user.uid}_${listingId}`, {
          userId: user.uid,
          userEmail: user.email,
          fcmToken: user.fcmToken || null,
          listingId,
          listingTitle,
          sellerId,
          createdAt: serverTimestamp(),
        })
        setIsAlerted(true)
        toast({
          title: "🔔 Alert set!",
          description: `We'll notify you when "${listingTitle}" is available again.`,
          variant: "success",
        })
      }
    } catch {
      toast({ title: "Error setting alert", variant: "destructive" })
    }
    setLoading(false)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-800">
          {listingStatus === "sold" ? "This item has been sold" : "Temporarily unavailable"}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">Get notified the moment it becomes available again</p>
      </div>

      <Button
        onClick={handleToggle}
        disabled={loading}
        variant={isAlerted ? "outline" : "default"}
        size="sm"
        className={
          isAlerted
            ? "border-amber-300 text-amber-700 hover:bg-amber-100 w-full"
            : "bg-amber-500 hover:bg-amber-600 text-white w-full"
        }
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isAlerted ? (
          <><BellOff className="h-4 w-4 mr-2" /> Cancel Alert</>
        ) : (
          <><Bell className="h-4 w-4 mr-2" /> Notify Me When Available</>
        )}
      </Button>
    </div>
  )
}
