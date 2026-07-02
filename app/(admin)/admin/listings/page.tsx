"use client"
// app/(admin)/admin/listing-boosts/page.tsx
// Admin view of individual seller boosts (Standard/Premium/Category Top),
// purchased from the seller's Boost Center. This is separate from
// /admin/boost, which controls the external Ad Boost campaigns feature.
//
// The `boosts` table only stores listing_id/seller_id, so titles and seller
// names are resolved client-side against the listings/users collections.

import { useEffect, useState, useCallback } from "react"
import { AdminService } from "@/src/services"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Zap, Loader2, XCircle, CheckCircle2, Clock, Gift, RefreshCw,
} from "lucide-react"

interface BoostRow {
  id: string
  listingId?: string
  sellerId?: string
  duration?: string            // e.g. "Standard · 7 days"
  status?: string               // active | pending_payment | cancelled
  paymentReference?: string
  paymentProvider?: string
  activatedAt?: string
  boostEndsAt?: string
  createdAt?: string
}

interface ListingLite { id: string; title: string; images?: string[]; isBoosted?: boolean }
interface UserLite { uid?: string; id?: string; email?: string; fullName?: string; storeName?: string }

const STATUS_STYLES: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
  active:          { label: "Live",            className: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  pending_payment: { label: "Pending Payment", className: "bg-amber-100 text-amber-800",     Icon: Clock },
  cancelled:       { label: "Cancelled",       className: "bg-red-100 text-red-700",         Icon: XCircle },
}

function statusOf(status?: string) {
  return STATUS_STYLES[status ?? ""] ?? { label: status || "Unknown", className: "bg-gray-100 text-gray-600", Icon: Clock }
}

// Duration is stored as "Standard · 7 days" — split it back into plan name
// and human duration for display, since there's no dedicated plan column.
function splitDuration(duration?: string): { plan: string; length: string } {
  if (!duration) return { plan: "—", length: "—" }
  const [plan, length] = duration.split("·").map(s => s.trim())
  return { plan: plan || duration, length: length || "" }
}

function isExpired(boostEndsAt?: string) {
  if (!boostEndsAt) return false
  return new Date(boostEndsAt).getTime() < Date.now()
}

export default function AdminListingBoostsPage() {
  const { toast } = useToast()
  const [boosts,   setBoosts]   = useState<BoostRow[]>([])
  const [listings, setListings] = useState<Record<string, ListingLite>>({})
  const [users,    setUsers]    = useState<Record<string, UserLite>>({})
  const [loading,  setLoading]  = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const load = useCallback(async () => {
    try {
      const [boostRows, listingRows, userRows] = await Promise.all([
        AdminService.getCollection("boosts") as Promise<BoostRow[]>,
        AdminService.getCollection("listings") as Promise<ListingLite[]>,
        AdminService.getCollection("users") as Promise<UserLite[]>,
      ])

      const listingMap: Record<string, ListingLite> = {}
      for (const l of listingRows) listingMap[l.id] = l

      const userMap: Record<string, UserLite> = {}
      for (const u of userRows) userMap[(u.uid ?? u.id) as string] = u

      const sorted = [...boostRows].sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      )

      setBoosts(sorted)
      setListings(listingMap)
      setUsers(userMap)
    } catch (e: any) {
      toast({ title: "Failed to load boosts", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleRefresh = () => { setRefreshing(true); load() }

  const handleCancel = async (boost: BoostRow) => {
    if (!boost.listingId) return
    setCancellingId(boost.id)
    try {
      await AdminService.updateDoc("boosts", boost.id, { status: "cancelled" })
      await AdminService.updateDoc("listings", boost.listingId, {
        isBoosted: false,
        boostExpiresAt: null,
      })
      setBoosts(prev => prev.map(b => b.id === boost.id ? { ...b, status: "cancelled" } : b))
      toast({ title: "Boost cancelled", description: "The listing is no longer boosted.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Cancel failed", description: e.message, variant: "destructive" })
    } finally {
      setCancellingId(null)
    }
  }

  const handleDelete = async (boost: BoostRow) => {
    if (!confirm("Permanently delete this cancelled boost record? This cannot be undone.")) return
    setDeletingId(boost.id)
    try {
      await AdminService.deleteDoc("boosts", boost.id)
      setBoosts(prev => prev.filter(b => b.id !== boost.id))
      toast({ title: "Boost deleted", description: "The record was permanently removed.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = statusFilter === "all"
    ? boosts
    : statusFilter === "expired"
      ? boosts.filter(b => b.status === "active" && isExpired(b.boostEndsAt))
      : boosts.filter(b => b.status === statusFilter)

  const activeCount  = boosts.filter(b => b.status === "active" && !isExpired(b.boostEndsAt)).length
  const pendingCount = boosts.filter(b => b.status === "pending_payment").length
  const expiredCount = boosts.filter(b => b.status === "active" && isExpired(b.boostEndsAt)).length

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-5xl space-y-6 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Listing Boosts
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every Standard / Premium / Category Top boost sellers have purchased from their Boost Center —
            live, pending payment, or cancelled. This is separate from the external Ad Boost campaigns page.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Live</p>
          <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending Payment</p>
          <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Expired (still marked active)</p>
          <p className="text-xl font-bold text-red-500">{expiredCount}</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Live</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired (needs cleanup)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
          <Gift className="h-8 w-8 mx-auto opacity-40 mb-2" />
          No boosts match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const { plan, length } = splitDuration(b.duration)
            const listing = b.listingId ? listings[b.listingId] : undefined
            const seller  = b.sellerId ? users[b.sellerId] : undefined
            const expired = b.status === "active" && isExpired(b.boostEndsAt)
            const { label, className, Icon } = expired
              ? { label: "Expired", className: "bg-gray-100 text-gray-500", Icon: Clock }
              : statusOf(b.status)
            const isFree = b.paymentReference === "free_credit"

            return (
              <Card key={b.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate max-w-[220px]">
                        {listing?.title || b.listingId || "Unknown listing"}
                      </p>
                      <Badge className={`${className} flex items-center gap-1 text-xs`}>
                        <Icon className="h-3 w-3" /> {label}
                      </Badge>
                      {isFree && (
                        <Badge className="bg-emerald-50 text-emerald-700 text-xs flex items-center gap-1">
                          <Gift className="h-3 w-3" /> Free credit
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan} · {length} · Seller: {seller?.storeName || seller?.fullName || seller?.email || b.sellerId || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.activatedAt && <>Activated {new Date(b.activatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · </>}
                      {b.boostEndsAt
                        ? <>Expires {new Date(b.boostEndsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</>
                        : "Not yet activated"}
                    </p>
                  </div>

                  {b.status !== "cancelled" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleCancel(b)}
                      disabled={cancellingId === b.id}
                    >
                      {cancellingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Cancel</>}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => handleDelete(b)}
                      disabled={deletingId === b.id}
                    >
                      {deletingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Delete</>}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
