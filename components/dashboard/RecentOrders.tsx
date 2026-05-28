"use client"

import {AdminService, query, limit, orderBy, onSnapshot, where} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"
import { ExternalLink, Clock } from "lucide-react"
const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  escrow_held: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-amber-100 text-amber-800",
  inspecting: "bg-orange-100 text-orange-800",
  completed: "bg-emerald-100 text-emerald-800",
  disputed: "bg-red-100 text-red-800" }

export function RecentOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const q = AdminService._ref_("orders", [where("buyerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    ])

    const unsub = onSnapshot(q, docs => {
      setOrders(docs.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))

    return unsub
  }, [user?.uid])

  if (loading) return <div className="h-40 bg-muted animate-pulse rounded-xl" />
  if (orders.length === 0) return <p className="text-muted-foreground py-8 text-center">No orders yet. Start browsing!</p>

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Recent Orders</CardTitle>
        <Button variant="link" size="sm" asChild><Link href="/dashboard/buyer/orders">View All <ExternalLink className="h-3 w-3 ml-1" /></Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {orders.map(order => (
          <div key={order.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <div className="space-y-1">
              <p className="font-medium text-sm">{order.itemTitle || "Untitled Item"}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{order.createdAt?.toDate?.().toLocaleDateString() || "Just now"}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={statusColors[order.status] || "bg-gray-100"}>{order.status.replace("_", " ")}</Badge>
              <span className="font-semibold text-sm">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
      }
