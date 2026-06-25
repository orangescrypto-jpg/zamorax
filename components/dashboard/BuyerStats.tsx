"use client"
import { where } from "@/src/services"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent } from "@/components/ui/card"
import { ShoppingBag, Heart, Clock, Wallet } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import {AdminService} from "@/src/services"

export function BuyerStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ orders: 0, saved: 0, activeRentals: 0, spent: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const uid = user.uid
    const unsubOrders = AdminService.subscribeToCollection("orders", docs => setStats(s => ({ ...s, orders: docs.length })), [where("buyerId", "==", uid)])
    const unsubSaved = AdminService.subscribeToCollection(`users/${uid}/savedListings`, docs => setStats(s => ({ ...s, saved: docs.length })))
    const unsubRentals = AdminService.subscribeToCollection("orders", docs => setStats(s => ({ ...s, activeRentals: docs.length })), [where("orderType", "==", "rental"), where("status", "in", ["escrow_held", "delivered", "inspecting"])])
    const unsubSpent = AdminService.subscribeToCollection("orders", docs => {
      const total = docs.reduce((sum: number, doc: any) => sum + (doc.totalAmount || 0), 0)
      setStats(s => ({ ...s, spent: total }))
    }, [where("status", "==", "completed")])
    setLoading(false)
    return () => { unsubOrders(); unsubSaved(); unsubRentals(); unsubSpent() }
  }, [user?.uid])

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />
  const items = [
    { label: "Total Orders", value: stats.orders, icon: <ShoppingBag className="h-5 w-5" />, color: "text-blue-600 bg-blue-50" },
    { label: "Active Rentals", value: stats.activeRentals, icon: <Clock className="h-5 w-5" />, color: "text-amber-600 bg-amber-50" },
    { label: "Saved Items", value: stats.saved, icon: <Heart className="h-5 w-5" />, color: "text-red-500 bg-red-50" },
    { label: "Total Spent", value: formatPrice(stats.spent), icon: <Wallet className="h-5 w-5" />, color: "text-emerald-600 bg-emerald-50" },
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
