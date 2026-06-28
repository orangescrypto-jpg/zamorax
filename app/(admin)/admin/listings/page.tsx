"use client"
// app/(admin)/admin/listings/page.tsx
// Tabs: Pending (review queue) | Active (manage live) | Rejected | All

import { useCallback, useEffect, useRef, useState } from "react"
import { adminFetch } from "@/lib/admin-fetch"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { getCategoryBySlug } from "@/constants/categories"
import { formatPrice, truncateText } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2, CheckCircle, XCircle, MapPin, PlusCircle,
  Sparkles, RefreshCw, Trash2, Search, Eye,
} from "lucide-react"

type Listing = {
  id: string
  title: string
  description?: string
  priceSale: number
  categorySlug?: string
  images?: string[]
  status?: string
  isBoosted?: boolean
  city?: string
  sellerName?: string
  views?: number
  createdAt?: string
}

type StatusFilter = "pending" | "active" | "rejected" | "all"

const PAGE_SIZE = 20

export default function AdminListingsPage() {
  const { toast } = useToast()
  const router    = useRouter()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending")
  const [search,       setSearch]       = useState("")
  const [listings,     setListings]     = useState<Listing[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(0)
  const [hasMore,      setHasMore]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [processing,   setProcessing]   = useState<string | null>(null)
  const [fetchError,   setFetchError]   = useState<string | null>(null)

  // Reject dialog
  const [rejectId,     setRejectId]     = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectOpen,   setRejectOpen]   = useState(false)

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null)
  const [deleteOpen,   setDeleteOpen]   = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchListings = useCallback(async (
    status: StatusFilter, q: string, p: number, append = false
  ) => {
    if (!append) setLoading(true)
    else         setLoadingMore(true)
    try {
      const params = new URLSearchParams({
        status, page: String(p), ...(q ? { search: q } : {}),
      })
      const res  = await adminFetch(`/api/admin/manage-listings?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`)
      if (append) setListings(prev => [...prev, ...(data.listings ?? [])])
      else        setListings(data.listings ?? [])
      setTotal(data.total ?? 0)
      setHasMore(data.hasMore ?? false)
      setPage(p)
      setFetchError(null)
    } catch (err: any) {
      if (!append) setListings([])
      setFetchError(err.message ?? "Failed to load listings")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => { fetchListings(statusFilter, search, 0) }, [statusFilter]) // eslint-disable-line

  const handleTabChange = (val: string) => {
    setStatusFilter(val as StatusFilter)
    setSearch("")
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchListings(statusFilter, val, 0), 400)
  }

  const reload = () => fetchListings(statusFilter, search, 0)

  const patch = async (id: string, action: string, extra?: Record<string, unknown>) => {
    setProcessing(id)
    try {
      const res = await adminFetch("/api/admin/manage-listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      // Remove from current list (status changed)
      if (action !== "boost" && action !== "unboost") {
        setListings(prev => prev.filter(l => l.id !== id))
        setTotal(t => Math.max(0, t - 1))
      } else {
        setListings(prev => prev.map(l =>
          l.id === id ? { ...l, isBoosted: action === "boost" } : l
        ))
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleApprove = (id: string) => {
    patch(id, "approve")
    toast({ title: "Approved", description: "Listing is now live.", variant: "success" })
  }

  const handleRejectSubmit = async () => {
    if (!rejectId || !rejectReason.trim()) return
    await patch(rejectId, "reject", { reason: rejectReason })
    setRejectOpen(false); setRejectReason(""); setRejectId(null)
    toast({ title: "Rejected", description: "Seller notified.", variant: "destructive" })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setProcessing(deleteTarget.id)
    try {
      const res = await adminFetch(`/api/admin/manage-listings?id=${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error)
      setListings(prev => prev.filter(l => l.id !== deleteTarget.id))
      setTotal(t => Math.max(0, t - 1))
      setDeleteOpen(false); setDeleteTarget(null)
      toast({ title: "Deleted", description: "Listing permanently removed.", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const ListingCard_ = ({ listing }: { listing: Listing }) => {
    const cat     = getCategoryBySlug(listing.categorySlug ?? "")
    const busy    = processing === listing.id
    const isPending  = listing.status === "pending"
    const isActive   = listing.status === "active"
    const isRejected = listing.status === "rejected"

    return (
      <Card className="overflow-hidden border-border/60">
        <div className="h-40 bg-muted relative">
          {listing.images?.[0]
            ? <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No Image</div>
          }
          <Badge className={`absolute top-2 left-2 text-[10px] ${
            isPending  ? "bg-warning text-warning-foreground" :
            isActive   ? "bg-emerald-500 text-white" :
            isRejected ? "bg-red-500 text-white" : "bg-gray-500 text-white"
          }`}>
            {listing.status ?? "unknown"}
          </Badge>
          {listing.isBoosted && (
            <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px]">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Boosted
            </Badge>
          )}
        </div>

        <CardContent className="p-4 space-y-2">
          <h3 className="font-medium line-clamp-2 text-sm">{truncateText(listing.title, 60)}</h3>
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-primary">{formatPrice(listing.priceSale)}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" /> {listing.city ?? "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {cat?.name ?? listing.categorySlug} · {listing.sellerName ?? "Unknown seller"}
          </p>
          {listing.views !== undefined && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" /> {listing.views} views
            </p>
          )}

          <div className="pt-1 space-y-2">
            {/* Approve / Reject — only for pending */}
            {isPending && (
              <div className="flex gap-2">
                <Button
                  onClick={() => handleApprove(listing.id)}
                  disabled={!!busy}
                  className="flex-1 bg-accent hover:bg-accent/90 text-white h-8 text-xs"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { setRejectId(listing.id); setRejectOpen(true) }}
                  disabled={!!busy}
                  className="h-8 px-3"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Approve rejected listing back to active */}
            {isRejected && (
              <Button
                onClick={() => handleApprove(listing.id)}
                disabled={!!busy}
                className="w-full h-8 text-xs bg-accent hover:bg-accent/90 text-white"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Re-approve</>}
              </Button>
            )}

            {/* Boost / Unboost — all statuses */}
            <Button
              variant={listing.isBoosted ? "default" : "outline"}
              size="sm"
              className={`w-full h-8 text-xs ${listing.isBoosted ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
              onClick={() => patch(listing.id, listing.isBoosted ? "unboost" : "boost")}
              disabled={!!busy}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {listing.isBoosted ? "Remove Boost" : "Boost & Feature"}
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => { setDeleteTarget(listing); setDeleteOpen(true) }}
              disabled={!!busy}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Listing Management</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review pending, manage active, and clean up rejected listings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search listings..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <Button variant="outline" size="icon" onClick={reload} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => router.push("/admin/listings/post")} className="bg-primary text-white h-9 text-xs">
            <PlusCircle className="h-4 w-4 mr-1" /> Post
          </Button>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending {statusFilter === "pending" && total > 0 ? `(${total})` : ""}
          </TabsTrigger>
          <TabsTrigger value="active">
            Active {statusFilter === "active" && total > 0 ? `(${total})` : ""}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected {statusFilter === "rejected" && total > 0 ? `(${total})` : ""}
          </TabsTrigger>
          <TabsTrigger value="all">
            All {statusFilter === "all" && total > 0 ? `(${total})` : ""}
          </TabsTrigger>
        </TabsList>

        {(["pending","active","rejected","all"] as StatusFilter[]).map(key => (
          <TabsContent key={key} value={key}>
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : fetchError ? (
              <div className="text-center py-16 border border-dashed rounded-xl space-y-2">
                <p className="text-sm text-red-500 font-medium">⚠️ {fetchError}</p>
                <Button onClick={reload} variant="outline" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                </Button>
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl space-y-2">
                <p className="text-sm">
                  {key === "pending" ? "🎉 All caught up! No pending listings." :
                   key === "active"  ? "No active listings yet." :
                   key === "rejected"? "No rejected listings." :
                                       "No listings found."}
                </p>
                <Button onClick={reload} variant="outline" size="sm">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {listings.map(l => <ListingCard_ key={l.id} listing={l} />)}
                </div>
                {hasMore && (
                  <div className="flex justify-center pt-6">
                    <Button
                      variant="outline"
                      onClick={() => fetchListings(statusFilter, search, page + 1, true)}
                      disabled={loadingMore}
                    >
                      {loadingMore
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
                        : `Load Next ${PAGE_SIZE} Listings`}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Listing</DialogTitle>
            <DialogDescription>Provide a clear reason so the seller can fix and resubmit.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g., Image is blurry, IMEI doesn't match, price violates policy..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button onClick={handleRejectSubmit} disabled={!rejectReason.trim() || !!processing} variant="destructive">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Permanently delete listing?</DialogTitle>
            <DialogDescription>
              This will completely remove <strong>{deleteTarget?.title}</strong> from the platform. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!!processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" /> Delete Forever</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
