"use client"
"use client"

import { AdminService, where, orderBy, query, collection, onSnapshot } from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { ListingsService } from "@/src/services"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Listing } from "@/src/types"
import { getCategoryBySlug } from "@/constants/categories"
import { formatPrice, truncateText } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, CheckCircle, XCircle, MapPin, PlusCircle, Sparkles, RefreshCw } from "lucide-react"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"
import { updateDoc } from "@/src/services"

const PAGE_SIZE = 20

export default function AdminListingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [processing, setProcessing] = useState(false)

  const { items: listings, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection<Listing>({
      collectionPath: "listings",
      constraints: [where("status", "==", "pending"), orderBy("createdAt", "desc")],
      pageSize: PAGE_SIZE,
    })

  useEffect(() => { reload() }, [])

  const handleToggleBoost = async (listing: Listing) => {
    try {
      const newBoosted = !listing.isBoosted
      await AdminService.updateDoc("listings", listing.id, {
        isBoosted: newBoosted,
        isFeatured: newBoosted,
        boostType: newBoosted ? "premium" : null,
        boostExpiresAt: newBoosted ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
      })
      toast({ title: newBoosted ? "Listing Boosted!" : "Boost Removed", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const handleApprove = async (id: string) => {
    if (!user?.uid) return
    setProcessing(true)
    try {
      await ListingsService.approveListing(id, user.uid)
      toast({ title: "Approved", description: "Listing is now live.", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally { setProcessing(false) }
  }

  const handleRejectSubmit = async () => {
    if (!user?.uid || !rejectingId || !rejectReason.trim()) return
    setProcessing(true)
    try {
      await ListingsService.rejectListing(rejectingId, user.uid, rejectReason)
      setDialogOpen(false)
      setRejectReason("")
      setRejectingId(null)
      toast({ title: "Rejected", description: "Seller notified. Listing hidden.", variant: "destructive" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally { setProcessing(false) }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (!loading && listings.length === 0) return (
    <div className="container py-10 text-center space-y-4">
      <h2 className="text-2xl font-heading font-bold">Moderation Queue</h2>
      <p className="text-muted-foreground">All caught up! No pending listings to review.</p>
      <div className="flex justify-center gap-2">
        <Button onClick={reload} variant="outline"><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        <Button onClick={() => router.push("/admin/listings/post")} className="bg-primary text-white">
          <PlusCircle className="h-4 w-4 mr-2" /> Post a Listing
        </Button>
      </div>
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            Moderation Queue
            <Badge variant="secondary">{total} loaded</Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Showing pending listings oldest-first per page.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={reload} title="Refresh queue">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => router.push("/admin/listings/post")} className="bg-primary text-white">
            <PlusCircle className="h-4 w-4 mr-2" /> Post Listing
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => {
          const cat = getCategoryBySlug(listing.categorySlug)
          return (
            <Card key={listing.id} className="overflow-hidden border-border/60">
              <div className="h-40 bg-muted relative">
                {listing.images?.[0]
                  ? <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>
                }
                <Badge className="absolute top-2 left-2 bg-warning text-warning-foreground">
                  {cat?.name || listing.categorySlug}
                </Badge>
              </div>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-medium line-clamp-2">{truncateText(listing.title, 60)}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-primary">{formatPrice(listing.priceSale)}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {listing.city}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{listing.description}</p>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleApprove(listing.id)}
                    disabled={processing}
                    className="flex-1 bg-accent hover:bg-accent/90 text-white"
                  >
                    {processing
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => { setRejectingId(listing.id); setDialogOpen(true) }}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant={listing.isBoosted ? "default" : "outline"}
                  size="sm"
                  className={`w-full ${listing.isBoosted ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                  onClick={() => handleToggleBoost(listing)}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {listing.isBoosted ? "Remove Boost" : "Boost & Feature"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        total={total}
        label={`Load Next ${PAGE_SIZE} Listings`}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim() || processing}
              variant="destructive"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
