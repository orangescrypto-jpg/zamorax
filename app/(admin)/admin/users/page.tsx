"use client"
// app/(admin)/admin/users/page.tsx
// Replaced usePaginatedCollection (client-side D1) → /api/admin/users (server-side D1)

import { useEffect, useState, useCallback, useRef } from "react"
import { AdminUserRow } from "@/components/admin/AdminUserRow"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Search, Users, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminFetch } from "@/lib/admin-fetch"

const PAGE_SIZE = 25

type UserRow = {
  id: string
  uid: string
  fullName?: string
  email?: string
  phone?: string
  username?: string
  role?: string
  plan?: string
  isBanned?: boolean
  ninVerified?: boolean
  [key: string]: any
}

type Filter = "all" | "seller" | "buyer" | "banned" | "moderator" | "admin"

export default function AdminUsersPage() {
  const [filter,      setFilter]      = useState<Filter>("all")
  const [search,      setSearch]      = useState("")
  const [users,       setUsers]       = useState<UserRow[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(0)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (
    f: Filter, q: string, p: number, append = false
  ) => {
    if (!append) setLoading(true)
    else         setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        filter: f, page: String(p), ...(q ? { search: q } : {}),
      })
      const res  = await adminFetch(`/api/admin/users?${params}`)
      const data = await res.json()
      if (append) setUsers(prev => [...prev, ...(data.users ?? [])])
      else        setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
      setHasMore(data.hasMore ?? false)
      setPage(p)
    } catch {
      if (!append) setUsers([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Reload when filter changes
  useEffect(() => {
    fetchUsers(filter, search, 0)
  }, [filter]) // eslint-disable-line

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchUsers(filter, val, 0), 400)
  }

  const handleTabChange = (val: string) => {
    setFilter(val as Filter)
    setSearch("")
  }

  const reload = () => fetchUsers(filter, search, 0)

  const TAB_COUNTS: Record<Filter, number> = {
    all:       filter === "all"       ? total : 0,
    seller:    filter === "seller"    ? total : 0,
    buyer:     filter === "buyer"     ? total : 0,
    banned:    filter === "banned"    ? total : 0,
    moderator: filter === "moderator" ? total : 0,
    admin:     filter === "admin"     ? total : 0,
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage accounts, verification status, bans, and plan overrides.
            {total > 0 && (
              <span className="ml-2 text-xs text-primary font-medium">{total} {filter !== "all" ? filter : ""} users</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="seller">Sellers</TabsTrigger>
          <TabsTrigger value="buyer">Buyers</TabsTrigger>
          <TabsTrigger value="banned">Banned</TabsTrigger>
          <TabsTrigger value="moderator">Moderators</TabsTrigger>
          <TabsTrigger value="admin">Admins</TabsTrigger>
        </TabsList>

        {(["all","seller","buyer","banned","moderator","admin"] as Filter[]).map(key => (
          <TabsContent key={key} value={key} className="space-y-3">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                No users found matching your criteria.
              </div>
            ) : (
              <>
                {users.map(u => <AdminUserRow key={u.uid ?? u.id} user={u} />)}

                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => fetchUsers(filter, search, page + 1, true)}
                      disabled={loadingMore}
                    >
                      {loadingMore
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
                        : `Load Next ${PAGE_SIZE} Users`
                      }
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
