"use client"
// app/(admin)/admin/users/page.tsx
// User Management: search, filter by role, ban/unban, role & plan changes

import { useCallback, useEffect, useRef, useState } from "react"
import { adminFetch } from "@/lib/admin-fetch"
import { useToast } from "@/components/ui/use-toast"
import { AdminUserRow } from "@/components/admin/AdminUserRow"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, RefreshCw, Search, Users } from "lucide-react"

type UserFilter = "all" | "seller" | "buyer" | "banned" | "moderator" | "admin"

const PAGE_SIZE = 25

export default function AdminUsersPage() {
  const { toast } = useToast()

  const [filter,      setFilter]      = useState<UserFilter>("all")
  const [search,      setSearch]      = useState("")
  const [users,       setUsers]       = useState<any[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(0)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (
    f: UserFilter, q: string, p: number, append = false
  ) => {
    if (!append) setLoading(true)
    else         setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        filter: f,
        page:   String(p),
        ...(q ? { search: q } : {}),
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

  useEffect(() => { fetchUsers(filter, search, 0) }, [filter]) // eslint-disable-line

  const handleTabChange = (val: string) => {
    setFilter(val as UserFilter)
    setSearch("")
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchUsers(filter, val, 0), 400)
  }

  const reload = () => fetchUsers(filter, search, 0)

  const EmptyState = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border border-dashed rounded-xl">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {search ? `No results for "${search}"` : "Nothing to show here yet."}
        </p>
      </div>
      <Button onClick={reload} variant="outline" size="sm">
        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
      </Button>
    </div>
  )

  const TABS: { value: UserFilter; label: string }[] = [
    { value: "all",       label: "All" },
    { value: "seller",    label: "Sellers" },
    { value: "buyer",     label: "Buyers" },
    { value: "moderator", label: "Moderators" },
    { value: "admin",     label: "Admins" },
    { value: "banned",    label: "Banned" },
  ]

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">User Management</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Search, filter, and manage all {total > 0 ? `${total.toLocaleString()} ` : ""}platform users.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Button variant="outline" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={filter} onValueChange={handleTabChange}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {filter === t.value && total > 0 ? ` (${total})` : ""}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(t => (
          <TabsContent key={t.value} value={t.value}>
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                label={
                  t.value === "banned"    ? "No banned users." :
                  t.value === "seller"    ? "No sellers yet." :
                  t.value === "buyer"     ? "No buyers yet." :
                  t.value === "moderator" ? "No moderators assigned." :
                  t.value === "admin"     ? "No other admins." :
                                            "No users found."
                }
              />
            ) : (
              <>
                <div className="space-y-3">
                  {users.map(u => (
                    <AdminUserRow key={u.id} user={u} />
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center pt-6">
                    <Button
                      variant="outline"
                      onClick={() => fetchUsers(filter, search, page + 1, true)}
                      disabled={loadingMore}
                    >
                      {loadingMore
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
                        : `Load Next ${PAGE_SIZE} Users`}
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
