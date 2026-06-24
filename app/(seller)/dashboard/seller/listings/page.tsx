"use client"
"use client"

import { useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { SellerListingCard } from "@/components/dashboard/SellerListingCard"
import { ListingLimitProgress } from "@/components/dashboard/ListingLimitProgress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2, PlusCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { where, orderBy } from "@/src/services"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"

const PAGE_SIZE = 20

export default function ManageListingsPage() {
  const uid = useAuthStore((s) => s.user?.uid)

  const { items: listings, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection({
      collectionPath: "listings",
      constraints: uid
        ? [where("sellerId", "==", uid), orderBy("createdAt", "desc")]
        : [],
      pageSize: PAGE_SIZE,
    })

  useEffect(() => { if (uid) reload() }, [uid])

  const byStatus = (status: string | string[]) =>
    listings.filter(l =>
      Array.isArray(status) ? status.includes(l.status) : l.status === status
    )

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Manage Listings</h1>
          <p className="text-muted-foreground">
            Edit, pause, or boost your items.
            <span className="ml-1 text-xs text-primary font-medium">{total} loaded</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90 text-white">
            <Link href="/dashboard/seller/post">
              <PlusCircle className="h-4 w-4 mr-2" /> Post New
            </Link>
          </Button>
        </div>
      </div>

      <ListingLimitProgress />

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-6 overflow-x-auto flex-nowrap">
          <TabsTrigger value="active">Active ({byStatus("active").length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({byStatus("draft").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({byStatus("rejected").length})</TabsTrigger>
          <TabsTrigger value="sold">Sold/Paused ({byStatus(["sold","paused"]).length})</TabsTrigger>
        </TabsList>

        {[
          { key: "active",   list: byStatus("active") },
          { key: "pending",  list: byStatus("pending") },
          { key: "draft",    list: byStatus("draft") },
          { key: "rejected", list: byStatus("rejected") },
          { key: "sold",     list: byStatus(["sold", "paused"]) },
        ].map(({ key, list }) => (
          <TabsContent key={key} value={key} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map(l => <SellerListingCard key={l.id} listing={l} />)}
            {list.length === 0 && <EmptyState />}
          </TabsContent>
        ))}
      </Tabs>

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        total={total}
        label={`Load Next ${PAGE_SIZE} Listings`}
      />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full text-center py-10 text-muted-foreground border border-dashed rounded-xl">
      No listings in this category.
    </div>
  )
}
