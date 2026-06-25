"use client"
import type { Listing } from "@/src/types"
type ListingWithExtras = Listing & { stockQty?: number; rejectionReason?: string }

import { AdminService, serverTimestamp } from "@/src/services"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CreateFlashDealModal } from "@/components/listings/FlashDeal"
import { ListingsService } from "@/src/services"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { Edit, Pause, Play, Trash2, ExternalLink, AlertCircle, Loader2, Zap, Package, Copy, Share2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"

const statusColors: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-800",
  pending:  "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  draft:    "bg-gray-100 text-gray-800",
  sold:     "bg-blue-100 text-blue-800",
  paused:   "bg-orange-100 text-orange-800",
}

export function SellerListingCard({ listing }: { listing: ListingWithExtras }) {
  const { toast } = useToast()
  const { settings } = usePlatformSettings()
  const [loading, setLoading] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [flashModalOpen, setFlashModalOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [restockOpen, setRestockOpen] = useState(false)
  const [restockQty, setRestockQty] = useState("")
  const [restockLoading, setRestockLoading] = useState(false)

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const { id, createdAt, updatedAt, views, status, isBoosted, boostType, boostExpiresAt, ...rest } = listing as any
      await AdminService.addDoc("listings", {
        ...rest,
        title:     `${listing.title} (Copy)`,
        status:    "draft",
        views:     0,
        isBoosted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Listing duplicated", description: "Saved as a draft — edit and publish when ready.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Duplication failed", description: e.message, variant: "destructive" })
    } finally { setDuplicating(false) }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/listings/${listing.id}`
    if (navigator.share) {
      try { await navigator.share({ title: listing.title, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      toast({ title: "Link copied!", description: "Listing URL copied to clipboard.", variant: "success" })
    }
  }

  const updateStatus = async (newStatus: string) => {
    setLoading(true)
    try {
      await AdminService.updateDoc("listings", listing.id, {
        status: newStatus,
        updatedAt: new Date(),
      })
      toast({
        title: "Updated",
        description: `Listing status changed to ${newStatus}`,
        variant: "success",
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await ListingsService.deleteListing(listing.id)
      toast({ title: "Listing deleted", description: "Your listing has been permanently removed.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
      setConfirmDelete(false)
    }
  }

  const handleRestock = async () => {
    const qty = parseInt(restockQty)
    if (!qty || qty < 1) return
    setRestockLoading(true)
    try {
      await AdminService.updateDoc("listings", listing.id, {
        stockQty: qty,
        status: "active",
        isActive: true,
        updatedAt: new Date(),
      })
      toast({ title: "Restocked!", description: `${qty} units added. Listing is now active.`, variant: "success" })
      setRestockOpen(false)
      setRestockQty("")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setRestockLoading(false)
    }
  }

  const isActive = listing.status === "active"
  const isPaused = listing.status === "paused"

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative aspect-video bg-muted">
        {listing.images?.[0] ? (
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
        <Badge className={`absolute top-2 left-2 text-xs ${statusColors[listing.status] ?? "bg-gray-100 text-gray-800"}`}>
          {listing.status}
        </Badge>
      </div>

      <CardContent className="p-3 flex-1 space-y-1">
        {/* FIX: CSS truncate instead of hard slice(0,N)+"..." */}
        <p className="font-medium text-sm truncate">{listing.title}</p>
        <p className="text-primary font-bold text-sm">{formatPrice(listing.priceSale || 0)}</p>
        {/* Stock display */}
        {listing.stockQty != null && (
          <div className={`flex items-center gap-1 text-xs font-medium mt-1 ${
            listing.stockQty === 0 ? "text-red-500" :
            listing.stockQty <= 3 ? "text-orange-500" : "text-emerald-600"
          }`}>
            <Package className="h-3 w-3" />
            {listing.stockQty === 0 ? "Out of stock" :
             listing.stockQty <= 3 ? `Only ${listing.stockQty} left` :
             `${listing.stockQty} in stock`}
          </div>
        )}

        {listing.status === "rejected" && listing.rejectionReason && (
          <div className="flex items-start gap-1.5 mt-1.5 text-xs text-red-600 bg-red-50 rounded p-1.5">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{listing.rejectionReason}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-0 flex flex-wrap gap-1.5">
        {/* View */}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
          <Link href={`/listings/${listing.id}`} target="_blank">
            <ExternalLink className="h-3 w-3 mr-1" /> View
          </Link>
        </Button>

        {/* Edit */}
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
          <Link href={`/dashboard/seller/listings/${listing.id}/edit`}>
            <Edit className="h-3 w-3 mr-1" /> Edit
          </Link>
        </Button>

        {/* Restock button — shows when out of stock OR status is sold */}
        {(listing.stockQty === 0 || listing.status === "sold") && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            onClick={() => setRestockOpen(true)}
          >
            <Package className="h-3 w-3 mr-1" /> Restock
          </Button>
        )}

        {/* Pause / Resume */}
        {(isActive || isPaused) && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => updateStatus(isActive ? "paused" : "active")}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isActive ? (
              <><Pause className="h-3 w-3 mr-1" /> Pause</>
            ) : (
              <><Play className="h-3 w-3 mr-1" /> Resume</>
            )}
          </Button>
        )}

        {/* Delete */}
        <Button
          size="sm" variant="ghost"
          className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={loading}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Delete
        </Button>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete this listing?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will permanently remove <strong>{listing.title}</strong> and cannot be undone.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={() => { setConfirmDelete(false); handleDelete() }}>Yes, delete it</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Flash Deal */}
        <Button
          size="sm"
          variant={(ListingsService as any).isFlashDealActive(listing) ? "default" : "outline"}
          className={`h-7 px-2 text-xs ${(ListingsService as any).isFlashDealActive(listing) ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
          onClick={() => setFlashModalOpen(true)}
        >
          <Zap className="h-3 w-3 mr-1" />
          {(ListingsService as any).isFlashDealActive(listing) ? "Flash Active" : "Flash Deal"}
        </Button>

        {settings.listingDuplicationEnabled && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleDuplicate} disabled={duplicating} title="Copy listing to draft">
            {duplicating ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Copy className="h-3 w-3 mr-1" /> Copy</>}
          </Button>
        )}

        {settings.shareListingEnabled && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleShare} title="Share listing">
            <Share2 className="h-3 w-3 mr-1" /> Share
          </Button>
        )}
      </CardFooter>

      {/* Restock Dialog */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Restock Listing</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Enter the new quantity available for <strong>{listing.title}</strong>. The listing will go back to active immediately.</p>
          <div className="space-y-2 pt-1">
            <Label>New Stock Quantity</Label>
            <Input
              type="number"
              min={1}
              placeholder="e.g. 5"
              value={restockQty}
              onChange={e => setRestockQty(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setRestockOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleRestock}
              disabled={restockLoading || !restockQty || parseInt(restockQty) < 1}
            >
              {restockLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm Restock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateFlashDealModal listing={listing} open={flashModalOpen} onClose={() => setFlashModalOpen(false)} />
    </Card>
  )
}
