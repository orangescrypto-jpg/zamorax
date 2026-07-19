"use client"
// app/(admin)/admin/official-sellers/page.tsx
// Dedicated list of all sellers currently marked "official" (Zamorax
// Enterprises-style accounts whose listings appear in the Zamorax Direct
// homepage section / /zamorax-direct page — see migration 0002,
// users.is_official). Reuses AdminUserRow for the actual toggle so this
// page and the main User Management page never drift out of sync — a
// seller marked here shows there too, and vice versa.
//
// To ADD a new official seller: go to Admin → Users, find or create the
// seller account, click "Mark Official" on their row. They'll then appear
// here automatically.

import { useCallback, useEffect, useRef, useState } from "react"
import { adminFetch } from "@/lib/admin-fetch"
import { AdminUserRow } from "@/components/admin/AdminUserRow"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Loader2, RefreshCw, Search, ShieldCheck, ArrowRight } from "lucide-react"

const PAGE_SIZE = 25

export default function OfficialSellersPage() {
  const [search,      setSearch]      = useState("")
  const [users,       setUsers]       = useState<any[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(0)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchUsers = useCallback(async (q: string, p: number, append = false) => {
    if (!append) setLoading(true)
    else         setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        filter: "official",
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

  useEffect(() => { fetchUsers("", 0) }, [fetchUsers])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchUsers(val, 0), 400)
  }

  const reload = () => fetchUsers(search, 0)

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Official Sellers
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {total > 0 ? `${total} ` : ""}account{total === 1 ? "" : "s"} marked official — their listings
            appear in the Zamorax Enterprises Direct homepage section and{" "}
            <Link href="/zamorax-direct" className="text-primary underline">/zamorax-direct</Link>.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search official sellers..."
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

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border border-dashed rounded-xl">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {search ? `No official sellers match "${search}"` : "No official sellers yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Go to User Management, find the seller account (e.g. "Zamorax Enterprises Ltd"),
              and click "Mark Official" on their row.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/users">
              Go to User Management <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
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
                onClick={() => fetchUsers(search, page + 1, true)}
                disabled={loadingMore}
              >
                {loadingMore
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
                  : `Load Next ${PAGE_SIZE}`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
