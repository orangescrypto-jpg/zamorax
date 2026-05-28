"use client"
import type { Order } from "@/src/types"
// app/(buyer)/dashboard/buyer/orders/page.tsx
// Server-side cursor pagination — 15 orders per page, cheapest Firestore reads

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { where, orderBy } from "@/src/services"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import Image from "next/image"
import {
  Loader2, ShoppingBag, Clock, CheckCircle,
  Truck, Package, ShieldAlert, ChevronRight, RefreshCw,
} from "lucide-react"

const PAGE_SIZE = 15

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700",   icon: <Clock className="h-3.5 w-3.5" /> },
  paid:      { label: "Paid",      color: "bg-blue-100 text-blue-700",     icon: <CheckCircle className="h-3.5 w-3.5" /> },
  shipped:   { label: "Shipped",   color: "bg-purple-100 text-purple-700", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-700", icon: <Package className="h-3.5 w-3.5" /> },
  completed: { label: "Completed", color: "bg-green-100 text-green-700",   icon: <CheckCircle className="h-3.5 w-3.5" /> },
  refunded:  { label: "Refunded",  color: "bg-gray-100 text-gray-600",     icon: <CheckCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600",       icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  disputed:  { label: "Disputed",  color: "bg-red-100 text-red-600",       icon: <ShieldAlert className="h-3.5 w-3.5" /> },
}

const TABS = [
  { key: "all",       label: "All",       filter: () => true },
  { key: "active",    label: "Active",    filter: (o: Order) => ["pending","paid","shipped","delivered"].includes(o.status) },
  { key: "completed", label: "Completed", filter: (o: Order) => o.status === "completed" },
  { key: "disputed",  label: "Disputed",  filter: (o: Order) => o.status === "disputed" },
]

function OrderCard({ order }: { order: Order }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  return (
    <Link href={`/dashboard/buyer/orders/${order.id}`}>
      <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
            {order.itemImage
              ? <Image src={order.itemImage} alt={order.itemTitle || ""} fill className="object-cover" />
              : <Package className="h-6 w-6 m-5 text-muted-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{order.itemTitle || "Order"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              #{order.id.slice(-6).toUpperCase()} · {order.createdAt
                ? formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })
                : ""}
            </p>
            <p className="text-sm font-bold text-primary mt-1">{formatPrice(order.totalAmount || 0)}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge className={`flex items-center gap-1 text-[10px] px-2 py-0.5 border-0 ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function BuyerOrdersPage() {
  const { user } = useAuth()

  const { items: orders, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection({
      collectionPath: "orders",
      constraints: user?.uid
        ? [where("buyerId", "==", user.uid), orderBy("createdAt", "desc")]
        : [],
      pageSize: PAGE_SIZE,
    })

  useEffect(() => { if (user?.uid) reload() }, [user?.uid])

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-2xl py-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> My Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total} orders loaded</p>
        </div>
        <Button variant="outline" size="icon" onClick={reload} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">No orders yet.</p>
          <Button asChild className="bg-primary text-white">
            <Link href="/">Start Shopping</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            {TABS.map(t => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
                <span className="ml-1 text-[10px] opacity-70">
                  ({orders.filter(t.filter).length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(t => (
            <TabsContent key={t.key} value={t.key} className="space-y-3">
              {orders.filter(t.filter).map(o => <OrderCard key={o.id} order={o} />)}
              {orders.filter(t.filter).length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-xl">
                  No {t.label.toLowerCase()} orders.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        total={total}
        label={`Load Next ${PAGE_SIZE} Orders`}
      />
    </div>
  )
}
