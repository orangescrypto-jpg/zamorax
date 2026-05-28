"use client"
"use client"

import { useEffect, useState } from "react"
import { AdminUserRow } from "@/components/admin/AdminUserRow"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Search, Users, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { where, orderBy } from "@/src/services"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"

const PAGE_SIZE = 25

export default function AdminUsersPage() {
  const [search, setSearch] = useState("")

  const { items: users, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection({
      collectionPath: "users",
      constraints: [orderBy("createdAt", "desc")],
      pageSize: PAGE_SIZE,
    })

  useEffect(() => { reload() }, [])

  const q = search.toLowerCase()
  const filtered = q
    ? users.filter(u =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.username?.toLowerCase().includes(q)
      )
    : users

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-muted-foreground">
            Manage accounts, verification status, bans, and plan overrides.
            <span className="ml-2 text-xs text-primary font-medium">{total} loaded</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
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

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="sellers">
            Sellers ({filtered.filter(u => u.role === "seller" || u.role === "both").length})
          </TabsTrigger>
          <TabsTrigger value="buyers">
            Buyers ({filtered.filter(u => u.role === "buyer" || u.role === "both").length})
          </TabsTrigger>
          <TabsTrigger value="banned">
            Banned ({filtered.filter(u => u.isBanned).length})
          </TabsTrigger>
        </TabsList>

        {[
          { key: "all",     list: filtered },
          { key: "sellers", list: filtered.filter(u => u.role === "seller" || u.role === "both") },
          { key: "buyers",  list: filtered.filter(u => u.role === "buyer"  || u.role === "both") },
          { key: "banned",  list: filtered.filter(u => u.isBanned) },
        ].map(({ key, list }) => (
          <TabsContent key={key} value={key} className="space-y-3">
            {list.map(u => <AdminUserRow key={u.id} user={u} />)}
            {list.length === 0 && <EmptyState />}
          </TabsContent>
        ))}
      </Tabs>

      {/* Only show Load More when not searching (search filters already-loaded items) */}
      {!search && (
        <LoadMoreButton
          hasMore={hasMore}
          loading={loadingMore}
          onLoadMore={loadMore}
          total={total}
          label={`Load Next ${PAGE_SIZE} Users`}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
      No users found matching your criteria.
    </div>
  )
}
