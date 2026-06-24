"use client"

// app/(admin)/admin/group-buys/page.tsx
// Admin interface for managing Group Buys:
//   - View all open / filled / expired / cancelled groups
//   - Create new group buy campaigns (link to any active listing)
//   - Cancel open groups (with notification to members)
//   - Manually trigger fulfillment for filled groups

import { AdminService, where, orderBy, serverTimestamp } from "@/src/services"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Users, Plus, Loader2, XCircle, CheckCircle2,
  ShoppingBag, RefreshCw, AlertCircle,
} from "lucide-react"

type GroupStatus = "open" | "filled" | "fulfilled" | "expired" | "cancelled"

interface GroupBuyDoc {
  id: string
  listingId: string
  listingTitle: string
  listingImage: string
  originalPrice: number
  groupPrice: number
  sellerId: string
  members: string[]
  status: GroupStatus
  expiresAt?: any
  createdAt?: any
}

const STATUS_BADGE: Record<GroupStatus, string> = {
  open:      "bg-blue-100 text-blue-800",
  filled:    "bg-amber-100 text-amber-800",
  fulfilled: "bg-emerald-100 text-emerald-800",
  expired:   "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800",
}

export default function AdminGroupBuysPage() {
  const { toast } = useToast()
  const { settings } = usePlatformSettings()

  const GROUP_SIZE     = settings.groupBuyMinParticipants ?? 5
  const GROUP_DISCOUNT = settings.groupBuyDiscountPercent ?? 15

  const [groups,      setGroups]      = useState<GroupBuyDoc[]>([])
  const [listings,    setListings]    = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [processing,  setProcessing]  = useState<string | null>(null)
  const [createOpen,  setCreateOpen]  = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // Create form state
  const [selectedListingId, setSelectedListingId] = useState("")
  const [creating, setCreating] = useState(false)

  // Load all group buys
  useEffect(() => {
    const unsub = AdminService.subscribeToCollection(
      "groupBuys",
      (snap) => { setGroups(snap as GroupBuyDoc[]); setLoading(false) },
      [orderBy("createdAt", "desc")]
    )
    return unsub
  }, [])

  // Load active listings for create form
  useEffect(() => {
    AdminService.getCollection("listings", [
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
    ]).then(setListings).catch(() => {})
  }, [])

  const filtered = filterStatus === "all"
    ? groups
    : groups.filter(g => g.status === filterStatus)

  // ── Create a new group buy ───────────────────────────────────────
  const handleCreate = async () => {
    if (!selectedListingId) {
      toast({ title: "Select a listing first", variant: "destructive" }); return
    }
    const listing = listings.find(l => l.id === selectedListingId)
    if (!listing) return
    setCreating(true)
    try {
      const groupPrice = Math.round(listing.priceSale * (1 - GROUP_DISCOUNT / 100))
      await AdminService.addDoc("groupBuys", {
        listingId:    listing.id,
        listingTitle: listing.title,
        listingImage: listing.images?.[0] || "",
        originalPrice: listing.priceSale,
        groupPrice,
        sellerId:     listing.sellerId,
        creatorId:    "admin",
        members:      [],
        memberNames:  [],
        status:       "open",
        expiresAt:    new Date(Date.now() + 48 * 3600_000),
        createdAt:    serverTimestamp(),
      })
      toast({ title: "Group Buy created!", variant: "success" })
      setCreateOpen(false)
      setSelectedListingId("")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setCreating(false) }
  }

  // ── Cancel a group buy ───────────────────────────────────────────
  const handleCancel = async (group: GroupBuyDoc) => {
    if (!confirm(`Cancel this group buy for "${group.listingTitle}"? Members will be notified.`)) return
    setProcessing(group.id)
    try {
      await AdminService.updateDoc("groupBuys", group.id, {
        status:      "cancelled",
        cancelledAt: serverTimestamp(),
      })
      // Notify each member
      for (const uid of group.members) {
        await AdminService.addDoc("notifications", {
          userId: uid,
          type:   "system",
          title:  "Group Buy Cancelled",
          body:   `The group buy for "${group.listingTitle}" was cancelled by the platform. No charges were made.`,
          link:   "/group-buy",
          read:   false,
          createdAt: serverTimestamp(),
        })
      }
      toast({ title: "Group buy cancelled", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  // ── Manually mark as fulfilled ───────────────────────────────────
  // Normally done by the Cloud Function — this is an admin override.
  const handleFulfill = async (group: GroupBuyDoc) => {
    if (!confirm(`Mark this group as fulfilled? This will notify all ${group.members.length} members to complete their purchase.`)) return
    setProcessing(group.id)
    try {
      await AdminService.updateDoc("groupBuys", group.id, {
        status:      "fulfilled",
        fulfilledAt: serverTimestamp(),
      })
      // Notify each member to go buy
      for (const uid of group.members) {
        await AdminService.addDoc("notifications", {
          userId: uid,
          type:   "group_buy",
          title:  "🎉 Your Group Buy is complete!",
          body:   `Your group for "${group.listingTitle}" is full. Buy now at the group price of ${formatPrice(group.groupPrice)}!`,
          link:   `/listings/${group.listingId}`,
          read:   false,
          createdAt: serverTimestamp(),
        })
      }
      toast({ title: "Group fulfilled — members notified!", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const stats = {
    open:      groups.filter(g => g.status === "open").length,
    filled:    groups.filter(g => g.status === "filled").length,
    fulfilled: groups.filter(g => g.status === "fulfilled").length,
  }

  return (
    <div className="container py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Group Buys
          </h1>
          <p className="text-sm text-muted-foreground">
            Create and manage group buy campaigns. Currently {GROUP_SIZE} buyers needed for {GROUP_DISCOUNT}% off.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Group Buy
        </Button>
      </div>

      {/* Feature flag warning */}
      {!settings.groupBuyEnabled && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Group Buy is <strong>disabled</strong> in Platform Settings — buyers cannot see the Group Buy page.
            Enable it in <a href="/admin/settings" className="underline">Settings</a> when ready.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open",      value: stats.open,      color: "text-blue-600",    bg: "bg-blue-50"    },
          { label: "Filled",    value: stats.filled,    color: "text-amber-600",   bg: "bg-amber-50"   },
          { label: "Fulfilled", value: stats.fulfilled, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(s => (
          <Card key={s.label} className={s.bg}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {["all", "open", "filled", "fulfilled", "expired", "cancelled"].map(s => (
          <Button
            key={s}
            size="sm"
            variant={filterStatus === s ? "default" : "outline"}
            className="capitalize text-xs"
            onClick={() => setFilterStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl py-16 text-center text-muted-foreground space-y-2">
          <Users className="h-10 w-10 mx-auto opacity-25" />
          <p className="font-medium">No group buys found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => {
            const memberCount = group.members?.length ?? 0
            const progress    = (memberCount / GROUP_SIZE) * 100
            const isProcessing = processing === group.id

            return (
              <Card key={group.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {group.listingImage ? (
                        <img src={group.listingImage} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{group.listingTitle}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="line-through">{formatPrice(group.originalPrice)}</span>
                          <span className="font-semibold text-emerald-600">{formatPrice(group.groupPrice)}</span>
                          <span>({GROUP_DISCOUNT}% off)</span>
                        </div>
                      </div>
                    </div>
                    <Badge className={STATUS_BADGE[group.status] ?? ""}>{group.status}</Badge>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {memberCount}/{GROUP_SIZE} members
                      </span>
                      {group.expiresAt && (
                        <span>Expires {new Date(group.expiresAt?.toDate?.() ?? group.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {group.status === "filled" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleFulfill(group)}
                        disabled={isProcessing}
                      >
                        {isProcessing
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                        Mark Fulfilled
                      </Button>
                    )}
                    {(group.status === "open" || group.status === "filled") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive/5"
                        onClick={() => handleCancel(group)}
                        disabled={isProcessing}
                      >
                        {isProcessing
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          : <XCircle className="h-3.5 w-3.5 mr-1" />}
                        Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`/listings/${group.listingId}`} target="_blank">View Listing</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Create Group Buy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select Listing</Label>
              <Select value={selectedListingId} onValueChange={setSelectedListingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an active listing…" />
                </SelectTrigger>
                <SelectContent>
                  {listings.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title} — {formatPrice(l.priceSale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedListingId && (() => {
              const l = listings.find(x => x.id === selectedListingId)
              if (!l) return null
              const gp = Math.round(l.priceSale * (1 - GROUP_DISCOUNT / 100))
              return (
                <div className="p-3 bg-primary/5 rounded-xl text-sm space-y-1 text-center">
                  <p className="text-muted-foreground text-xs">Group price ({GROUP_DISCOUNT}% off)</p>
                  <p className="text-xl font-bold text-primary">{formatPrice(gp)}</p>
                  <p className="text-xs text-muted-foreground">
                    {GROUP_SIZE} buyers needed · 48hr window
                  </p>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !selectedListingId}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
