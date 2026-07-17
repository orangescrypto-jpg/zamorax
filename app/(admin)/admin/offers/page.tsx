"use client"

// app/(admin)/admin/offers/page.tsx
// Admin view of the offers table. Offers auto-expire 24h after creation if
// never actioned, and are force-expired the moment they're spent on an order
// (see markOfferUsed in src/services/providers/cloudflare/offers.ts). This
// page lets an admin see that state and permanently purge expired rows.

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import { adminFetch } from "@/lib/admin-fetch"
import { Loader2, Tag, RefreshCw, Trash2, Search } from "lucide-react"

interface OfferRow {
  id: string
  listing_title?: string
  offer_amount?: number
  original_price?: number
  buyer_name?: string
  seller_name?: string
  status: string
  expires_at?: string
  created_at?: string
}

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  declined: "bg-red-100 text-red-700",
  expired:  "bg-gray-200 text-gray-600",
}

export default function AdminOffersPage() {
  const { toast } = useToast()
  const [offers, setOffers]   = useState<OfferRow[]>([])
  const [expiredCount, setExpiredCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch]   = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rowPendingDelete, setRowPendingDelete] = useState<OfferRow | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res  = await adminFetch("/api/admin/offers")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load offers")
      setOffers(json.offers ?? [])
      setExpiredCount(json.expiredCount ?? 0)
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function deleteAllExpired() {
    setDeleting(true)
    try {
      const res  = await adminFetch("/api/admin/offers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to delete expired offers")
      toast({ title: "Cleaned up ✅", description: `${json.deletedCount} expired offer(s) permanently deleted.`, variant: "success" as any })
      setConfirmOpen(false)
      await load()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  async function deleteOne(row: OfferRow) {
    setDeleting(true)
    try {
      const res  = await adminFetch("/api/admin/offers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId: row.id }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to delete offer")
      toast({ title: "Offer deleted", variant: "success" as any })
      setRowPendingDelete(null)
      await load()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const q = search.toLowerCase()
  const filtered = q
    ? offers.filter((o: OfferRow) =>
        o.id.toLowerCase().includes(q) ||
        o.listing_title?.toLowerCase().includes(q) ||
        o.buyer_name?.toLowerCase().includes(q) ||
        o.seller_name?.toLowerCase().includes(q)
      )
    : offers

  const byStatus = (status: string) => filtered.filter((o: OfferRow) => o.status === status)
  const expiredList = byStatus("expired")

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  const renderTable = (rows: OfferRow[]) => (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Listing</TableHead>
            <TableHead>Offer</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Seller</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No offers here.
              </TableCell>
            </TableRow>
          )}
          {rows.map(o => (
            <TableRow key={o.id}>
              <TableCell className="max-w-[180px] truncate">{o.listing_title || "—"}</TableCell>
              <TableCell>{formatPrice(o.offer_amount ?? 0)}</TableCell>
              <TableCell>{o.buyer_name || "—"}</TableCell>
              <TableCell>{o.seller_name || "—"}</TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}>{o.status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {o.expires_at ? new Date(o.expires_at).toLocaleString() : "—"}
              </TableCell>
              <TableCell className="text-right">
                {o.status === "expired" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRowPendingDelete(o)}
                    title="Delete this offer"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Tag className="h-6 w-6" /> Offers
          </h1>
          <p className="text-muted-foreground">
            Offers auto-expire 24 hours after they're made if never accepted or used, and are
            marked expired immediately once spent on an order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search offers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={load} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={expiredCount === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete all expired ({expiredCount})
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-4 flex-wrap gap-1">
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="accepted">Accepted ({byStatus("accepted").length})</TabsTrigger>
          <TabsTrigger value="declined">Declined ({byStatus("declined").length})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({expiredList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderTable(filtered)}</TabsContent>
        <TabsContent value="pending">{renderTable(byStatus("pending"))}</TabsContent>
        <TabsContent value="accepted">{renderTable(byStatus("accepted"))}</TabsContent>
        <TabsContent value="declined">{renderTable(byStatus("declined"))}</TabsContent>
        <TabsContent value="expired">{renderTable(expiredList)}</TabsContent>
      </Tabs>

      {/* Bulk delete confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all expired offers?</DialogTitle>
            <DialogDescription>
              This permanently removes {expiredCount} expired offer{expiredCount === 1 ? "" : "s"} from
              the database. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAllExpired} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single-row delete confirmation */}
      <Dialog open={!!rowPendingDelete} onOpenChange={(open: boolean) => !open && setRowPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this offer?</DialogTitle>
            <DialogDescription>
              This permanently removes the offer on "{rowPendingDelete?.listing_title || "this listing"}" from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRowPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rowPendingDelete && deleteOne(rowPendingDelete)}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
