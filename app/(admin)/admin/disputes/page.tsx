"use client"

// app/(admin)/admin/disputes/page.tsx
import { useEffect, useState } from "react"
import { orderBy } from "@/src/services"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"
import { DisputeCard } from "@/components/admin/DisputeCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ShieldAlert, RefreshCw, Search } from "lucide-react"

const PAGE_SIZE = 20

export default function AdminDisputesPage() {
  const [search, setSearch] = useState("")

  const { items: disputes, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection({
      collectionPath: "disputes",
      constraints:    [orderBy("createdAt", "desc")],
      pageSize:       PAGE_SIZE,
    })

  useEffect(() => { reload() }, [])

  const q        = search.toLowerCase()
  const filtered = q
    ? disputes.filter(d =>
        d.id.toLowerCase().includes(q)                        ||
        d.buyerName?.toLowerCase().includes(q)               ||
        d.sellerName?.toLowerCase().includes(q)              ||
        d.reason?.toLowerCase().includes(q)
      )
    : disputes

  const byStatus = (status: string) => filtered.filter((d: any) => d.status === status)

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  const openList        = byStatus("open")
  const investigatingList = byStatus("investigating")
  const escalatedList   = byStatus("escalated")
  const resolvedList    = byStatus("resolved")

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Dispute Resolution Centre
          </h1>
          <p className="text-muted-foreground">
            Review evidence, resolve conflicts, and manage escrow payouts.
            <span className="ml-2 text-xs text-primary font-medium">{total} loaded</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search disputes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="open">
        <TabsList className="mb-4 flex-wrap gap-1">
          <TabsTrigger value="open">
            Open
            {openList.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5">
                {openList.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="investigating">
            Investigating ({investigatingList.length})
          </TabsTrigger>

          {/* FIX: Escalated tab was missing — escalated disputes are now surfaced */}
          <TabsTrigger value="escalated">
            Escalated
            {escalatedList.length > 0 && (
              <span className="ml-1.5 bg-purple-600 text-white text-[10px] rounded-full px-1.5">
                {escalatedList.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="resolved">
            Resolved ({resolvedList.length})
          </TabsTrigger>

          <TabsTrigger value="all">
            All ({filtered.length})
          </TabsTrigger>
        </TabsList>

        {[
          { key: "open",          list: openList         },
          { key: "investigating", list: investigatingList },
          { key: "escalated",     list: escalatedList    },
          { key: "resolved",      list: resolvedList     },
          { key: "all",           list: filtered         },
        ].map(({ key, list }) => (
          <TabsContent key={key} value={key} className="space-y-4">
            {list.map((d: any) => (
              <DisputeCard key={d.id} dispute={d} onResolved={reload} />
            ))}
            {list.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                No {key} disputes.
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {!search && (
        <LoadMoreButton
          hasMore={hasMore}
          loading={loadingMore}
          onLoadMore={loadMore}
          total={total}
          label={`Load Next ${PAGE_SIZE} Disputes`}
        />
      )}
    </div>
  )
}
