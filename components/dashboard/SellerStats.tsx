"use client"
import { AdminService, where } from "@/src/services"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { Card, CardContent } from "@/components/ui/card"
import { Package, ShoppingBag, TrendingUp, Wallet } from "lucide-react"
import { formatPrice } from "@/lib/utils"

export function SellerStats() {
  const user = useAuthStore((state) => state.user)
  const [stats, setStats] = useState({ active: 0, pendingOrders: 0, revenue: 0, boosts: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const unsubActive   = AdminService.subscribeToCollection("listings",      snap => setStats(s => ({ ...s, active: snap.size })),        [where("status", "==", "active")])
    const unsubPending  = AdminService.subscribeToCollection("orders",        snap => setStats(s => ({ ...s, pendingOrders: snap.size })), [where("status", "in", ["pending", "escrow_held"])])
    const unsubRevenue  = AdminService.subscribeToCollection("orders",        snap => {
      const total = snap.docs.reduce((sum: number, doc: any) => sum + (doc.data().sellerPayout || 0), 0)
      setStats(s => ({ ...s, revenue: total }))
    }, [where("status", "==", "completed")])
    const unsubBoosts   = AdminService.subscribeToCollection("boosts",        snap => setStats(s => ({ ...s, boosts: snap.size })),        [where("isActive", "==", true)])
    setLoading(false)
    return () => { unsubActive(); unsubPending(); unsubRevenue(); unsubBoosts() }
  }, [user?.uid])

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />
  const items = [
    { label: "Active Listings", value: stats.active,        icon: <Package     className="h-5 w-5" />, color: "text-blue-600 bg-blue-50" },
    { label: "Pending Orders",  value: stats.pendingOrders, icon: <ShoppingBag className="h-5 w-5" />, color: "text-amber-600 bg-amber-50" },
    { label: "Total Revenue",   value: formatPrice(stats.revenue), icon: <Wallet className="h-5 w-5" />, color: "text-emerald-600 bg-emerald-50" },
    { label: "Active Boosts",   value: stats.boosts,        icon: <TrendingUp  className="h-5 w-5" />, color: "text-purple-600 bg-purple-50" },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-bold mt-1">{item.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${item.color}`}>{item.icon}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
