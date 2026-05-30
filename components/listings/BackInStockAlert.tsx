"use client"

import { AdminService, serverTimestamp } from "@/src/services"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface BackInStockAlertProps {
  listingId: string
  listingTitle: string
  sellerId: string
  listingStatus: string // "sold" | "paused" | "rented" etc
}

export function BackInStockAlert({
  listingId,
  listingTitle,
  sellerId,
  listingStatus }: BackInStockAlertProps) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [isAlerted, setIsAlerted] = useState(false)
  const [loading, setLoading] = useState(true)

  const isUnavailable = ["sold", "rented", "paused", "suspended"].includes(listingStatus)

  useEffect(() => {
    if (!user?.uid || !isUnavailable) { setLoading(false); return }

    const checkAlert = async () => {
      try {
        const snap = await AdminService.getDoc("stockAlerts", `${user.uid}_${listingId}`)
        setIsAlerted(!!snap)
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    checkAlert()
  }, [user?.uid, listingId, isUnavailable])

  const handleToggle = async () => {
    if (!user?.uid) { router.push("/login"); return }
    setLoading(true)

    try {
      if (isAlerted) {
        await AdminService.deleteDoc("stockAlerts", `${user.uid}_${listingId}`)
        setIsAlerted(false)
        toast({ title: "Alert removed", description: "You won't be notified about this listing." })
      } else {
        await AdminService.setDoc("stockAlerts", `${user.uid}_${listingId}`, {
          userId: user.uid,
          userEmail: user.email,
          fcmToken: user.fcmToken || null,
          listingId,
          listingTitle,
          sellerId,
          createdAt: serverTimestamp() })
        setIsAlerted(true)
        toast({
          title: "🔔 Alert set!",
          description: `We'll notify you when "${listingTitle}" is available again.`,
          variant: "success" })
      }
    } catch (e) {
      toast({ title: "Error setting alert", variant: "destructive" })
    }
    setLoading(false)
  }

  if (!isUnavailable) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-800">
          {listingStatus === "sold" ? "This item has been sold" : "Temporarily unavailable"}
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Get notified the moment it becomes available again
        </p>
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
          <>
            <BellOff className="h-4 w-4 mr-2" /> Cancel Alert
          </>
        ) : (
          <>
            <Bell className="h-4 w-4 mr-2" /> Notify Me When Available
          </>
        )}
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────
// SERVER-SIDE HELPER: Call this in a Cloud Function or API route
// when a listing status changes back to "active"
// Place in: lib/firebase/stockAlerts.ts
// ─────────────────────────────────────────────
/*

export async function notifyStockAlerts(listingId: string, listingTitle: string) {
  const docs = await AdminService.getCollection("stockAlerts", [where("listingId", "==", listingId)])

  const batch = AdminService.batch()

  for (const alertDoc of docs) {
    const { userId, fcmToken, userEmail } = alertDoc

    // 1. Create in-app notification
    await AdminService.addDoc("notifications", {
      userId,
      type: "system",
      title: "🎉 Back in stock!",
      body: `"${listingTitle}" is available again. Grab it before it's gone!`,
      link: `/listings/${listingId}`,
      isRead: false,
      createdAt: serverTimestamp() })

    // 2. If FCM token exists, send push via Firebase Admin (in Cloud Function)
    // await sendPushNotification(fcmToken, { title: "Back in stock!", body: listingTitle })

    // 3. Clean up the alert after notifying
    batch.delete(alertDoc.ref)
  }

  await batch.commit()
}
*/
