"use client"

import {AdminService, query, limit, orderBy, onSnapshot, where} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"
import { ExternalLink, Clock, ShoppingBag } from "lucide-react"
const STATUS_BADGES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  escrow_held: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800" }

export function SellerRecentActivity() {
  const uid = useAuthStore((state) => state.user?.uid)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const q = AdminService._ref_("orders", [where("sellerId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(5)
    ])
    const unsub = onSnapshot(q, docs => {
      setOrders(docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [uid])

  if (loading) return <div className="h-40 bg-muted animate-pulse rounded-xl" />
  if (orders.length === 0) return (
    <Card>
      <CardHeader><CardTitle>Recent Orders</CardTitle></CardHeader>
      <CardContent className="text-center py-8 text-muted-foreground">No orders yet. Keep listing items!</CardContent>
    </Card>
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Recent Orders</CardTitle>
        <Button variant="link" size="sm" asChild><Link href="/dashboard/seller/orders">View All <ExternalLink className="h-3 w-3 ml-1" /></Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map(order => (
          <div key={order.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <div className="space-y-1">
              <p className="font-medium text-sm">{order.itemTitle || "Order #" + order.id.slice(-4)}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {order.createdAt?.toDate?.().toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={STATUS_BADGES[order.status] || "bg-gray-100"}>{order.status.replace("_", " ")}</Badge>
              <span className="font-semibold text-sm">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
