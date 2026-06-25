"use client"

import {AdminService, onSnapshot, where, query} from "@/src/services"
// app/(buyer)/dashboard/buyer/saved/page.tsx
// KEY ADDITION: Share Wishlist button

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { ShareWishlistModal } from "@/components/saved/ShareWishlistModal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { Heart, Loader2, Trash2, ExternalLink, Share2, ShoppingBag } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function SavedItemsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)   // ← NEW

  useEffect(() => {
    if (!user?.uid) return
    const q = AdminService._ref_("savedListings", [where("userId", "==", user.uid)])
    return onSnapshot(q, docs => {
      setItems(docs.docs.map((d: any) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [user?.uid])

  const handleRemove = async (docId: string) => {
    setRemoving(docId)
    try {
      await AdminService.deleteDoc("savedListings", docId)
      toast({ title: "Removed from saved items", variant: "success" })
    } catch {
      toast({ title: "Could not remove item", variant: "destructive" })
    } finally { setRemoving(null) }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header with Share button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500 fill-red-500" /> Saved Items
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} saved</p>
        </div>

        {/* ── SHARE WISHLIST BUTTON (NEW) ── */}
        {items.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareOpen(true)}
            className="shrink-0"
          >
            <Share2 className="h-4 w-4 mr-2" /> Share List
          </Button>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Heart className="h-14 w-14 mx-auto text-muted-foreground/20" />
            <p className="font-semibold">No saved items yet</p>
            <p className="text-sm text-muted-foreground">
              Browse listings and tap the heart icon to save items here.
            </p>
            <Button asChild className="bg-primary text-white hover:bg-primary/90">
              <Link href="/search"><ShoppingBag className="h-4 w-4 mr-2" /> Browse Listings</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any) => (
            <Card key={item.id} className="overflow-hidden group">
              {/* Image */}
              <div className="relative aspect-video bg-muted">
                {item.listingImage ? (
                  <Image
                    src={item.listingImage}
                    alt={item.listingTitle || "Saved item"}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">No image</div>
                )}
              </div>

              <CardContent className="p-3 space-y-2">
                <p className="font-medium text-sm truncate">{item.listingTitle || "—"}</p>
                {item.listingPrice && (
                  <p className="text-primary font-bold">{formatPrice(item.listingPrice)}</p>
                )}

                <div className="flex gap-2">
                  <Button asChild size="sm" className="flex-1 h-8 text-xs bg-primary text-white hover:bg-primary/90">
                    <Link href={`/listings/${item.listingId}`}>
                      <ExternalLink className="h-3 w-3 mr-1" /> View
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-red-500 hover:bg-red-50 px-2"
                    onClick={() => handleRemove(item.id)}
                    disabled={removing === item.id}
                  >
                    {removing === item.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── SHARE WISHLIST MODAL (NEW) ── */}
      <ShareWishlistModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        listingIds={items.map(i => i.listingId).filter(Boolean)}
        listName="My Wishlist"
      />
    </div>
  )
}
