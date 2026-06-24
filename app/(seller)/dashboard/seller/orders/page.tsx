"use client"
import type { Order } from "@/src/types"
// app/(seller)/dashboard/seller/orders/page.tsx
// Server-side cursor pagination — 15 orders per page

import { useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { where, orderBy } from "@/src/services"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"
import { SellerOrderCard } from "@/components/orders/SellerOrderCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2, ShoppingBag, RefreshCw } from "lucide-react"

const PAGE_SIZE = 15

const TABS = [
  { key: "all",       label: "All",         filter: () => true },
  { key: "pending",   label: "New",          filter: (o: Order) => o.status === "pending" },
  { key: "active",    label: "In Progress",  filter: (o: Order) => ["paid","shipped","delivered"].includes(o.status) },
  { key: "completed", label: "Completed",    filter: (o: Order) => o.status === "completed" },
  { key: "disputed",  label: "Disputed",     filter: (o: Order) => o.status === "disputed" },
]

export default function SellerOrdersPage() {
  const uid = useAuthStore(s => s.user?.uid)

  const { items: orders, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection({
      collectionPath: "orders",
      constraints: uid
        ? [where("sellerId", "==", uid), orderBy("createdAt", "desc")]
        : [],
      pageSize: PAGE_SIZE,
    })

  useEffect(() => { if (uid) reload() }, [uid])

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> My Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total} orders loaded</p>
        </div>
        <Button variant="outline" size="icon" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">No orders yet. Keep selling!</p>
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="w-full overflow-x-auto flex-nowrap mb-4">
            {TABS.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="whitespace-nowrap">
                {t.label}
                <span className="ml-1 text-[10px] opacity-60">({orders.filter(t.filter).length})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(t => (
            <TabsContent key={t.key} value={t.key} className="space-y-3">
              {orders.filter(t.filter).map(o => (
                <SellerOrderCard key={o.id} order={o} />
              ))}
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
