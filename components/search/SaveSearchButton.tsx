"use client"

import {AdminService, where, serverTimestamp} from "@/src/services"
// components/search/SaveSearchButton.tsx

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { Bell, BellOff, Loader2 } from "lucide-react"

interface Props {
  searchParams: {
    q?: string
    category?: string
    listingType?: string
    condition?: string
    nigerianState?: string
    minPrice?: number
    maxPrice?: number
  }
}

export function SaveSearchButton({ searchParams }: Props) {
  const { user } = useAuth()
  const { settings } = usePlatformSettings()
  const router = useRouter()
  const { toast } = useToast()

  const [saved, setSaved]       = useState(false)
  const [alertId, setAlertId]   = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)

  // Build a label from current search params
  const label = [
    searchParams.q,
    searchParams.category?.replace(/_/g, " "),
    searchParams.condition?.replace(/_/g, " "),
    searchParams.nigerianState,
    searchParams.listingType,
    searchParams.minPrice ? `from ₦${searchParams.minPrice.toLocaleString()}` : null,
    searchParams.maxPrice ? `to ₦${searchParams.maxPrice.toLocaleString()}`   : null,
  ].filter(Boolean).join(" · ") || "All listings"

  // Check if this exact search is already saved
  useEffect(() => {
    if (!user?.uid) { setChecking(false); return }

    const check = async () => {
      const docs = await AdminService.getCollection("searchAlerts", [
        where("userId", "==", user.uid),
        where("label", "==", label),
      ])
      if (docs.length > 0) {
        setSaved(true)
        setAlertId(docs[0].id)
      }
      setChecking(false)
    }
    check()
  }, [user?.uid, label])

  const handleToggle = async () => {
    if (!user?.uid) { router.push("/login"); return }
    setLoading(true)

    try {
      if (saved && alertId) {
        // Remove the alert
        await AdminService.deleteDoc("searchAlerts", alertId)
        setSaved(false)
        setAlertId(null)
        toast({ title: "Search alert removed", variant: "success" })
      } else {
        // Check alert count limit
        const allAlerts = await AdminService.getCollection("searchAlerts", [
          where("userId", "==", user.uid),
        ])
        if (allAlerts.length >= settings.maxSearchAlertsPerUser) {
          toast({
            title: "Alert limit reached",
            description: `You can save up to ${settings.maxSearchAlertsPerUser} search alerts. Remove one to add a new one.`,
            variant: "destructive",
          })
          setLoading(false)
          return
        }

        // Enforce cooldown between identical saves
        const cooldownMs = settings.searchAlertCooldownHours * 60 * 60 * 1000
        const recent = allAlerts
          .map((d: any) => d.createdAt?.toMillis?.() ?? 0)
          .filter((t: number) => Date.now() - t < cooldownMs)
        if (recent.length > 0) {
          toast({
            title: "Please wait",
            description: `You can only add a new alert every ${settings.searchAlertCooldownHours} hours.`,
            variant: "destructive",
          })
          setLoading(false)
          return
        }

        // Save the alert
        const docRef = await AdminService.addDoc("searchAlerts", {
          userId: user.uid,
          label,
          filters: {
            q:             searchParams.q             || null,
            category:      searchParams.category      || null,
            listingType:   searchParams.listingType   || null,
            condition:     searchParams.condition     || null,
            nigerianState: searchParams.nigerianState || null,
            minPrice:      searchParams.minPrice      ? searchParams.minPrice * 100 : null,
            maxPrice:      searchParams.maxPrice      ? searchParams.maxPrice * 100 : null },
          lastNotifiedAt: null,
          createdAt: serverTimestamp() })
        setSaved(true)
        setAlertId(docRef.id)
        toast({
          title: "🔔 Search alert saved!",
          description: `We'll notify you when new listings match "${label}"`,
          variant: "success" })
      }
    } catch {
      toast({ title: "Could not update alert", variant: "destructive" })
    } finally { setLoading(false) }
  }

  if (checking) return null

  return (
    <Button
      variant={saved ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={saved ? "bg-primary text-white hover:bg-primary/90" : ""}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : saved ? (
        <><BellOff className="h-3.5 w-3.5 mr-1.5" /> Alert On</>
      ) : (
        <><Bell className="h-3.5 w-3.5 mr-1.5" /> Save Search</>
      )}
    </Button>
  )
}
