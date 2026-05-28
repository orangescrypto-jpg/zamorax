"use client"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(seller)/dashboard/seller/bundles/page.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Package, Plus, Trash2, Loader2, Tag, Percent } from "lucide-react"
import Image from "next/image"

export default function BundlesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [bundles, setBundles] = useState<any[]>([])
  const [myListings, setMyListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // New bundle form state
  const [bundleName, setBundleName] = useState("")
  const [discountPct, setDiscountPct] = useState("10")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!user?.uid) return

    // Load seller's bundles
    const bundleQ = AdminService._ref_("bundles", where("sellerId", "==", user.uid))
    const unsub = onSnapshot(bundleQ, docs => {
      setBundles(docs.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))

    // Load seller's active listings for bundle creation
    const loadListings = async () => {
      const q = await AdminService.getCollection("listings", where("sellerId", "==", user.uid),
        where("status", "==", "active")
      )
      const snap = await AdminService.getCollection(q)
      setMyListings(docs.docs.map(d => ({ id: d.id, ...d.data() }))
    }
    loadListings()

    return unsub
  }, [user?.uid])

  const selectedListings = myListings.filter(l => selectedIds.includes(l.id))
  const originalTotal    = selectedListings.reduce((s, l) => s + (l.priceSale || 0), 0)
  const discount         = Math.max(0, Math.min(80, Number(discountPct) || 0))
  const bundlePrice      = Math.round(originalTotal * (1 - discount / 100))
  const saving           = originalTotal - bundlePrice

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCreate = async () => {
    if (!user?.uid) return
    if (!bundleName.trim()) { toast({ title: "Enter a bundle name", variant: "destructive" }); return }
    if (selectedIds.length < 2) { toast({ title: "Select at least 2 items", variant: "destructive" }); return }
    if (discount < 1) { toast({ title: "Enter a discount (1–80%)", variant: "destructive" }); return }

    setCreating(true)
    try {
      await AdminService.addDoc("bundles", {
        name: bundleName.trim(),
        sellerId: user.uid,
        sellerName: user.fullName || user.storeName || user.email,
        listingIds: selectedIds,
        listingTitles: selectedListings.map(l => l.title),
        listingImages: selectedListings.map(l => l.images?.[0] || null),
        originalPrice: originalTotal,
        discountPercent: discount,
        bundlePrice,
        saving,
        status: "active",
        createdAt: serverTimestamp() })
      toast({ title: "Bundle created!", description: `Buyers can now save ${discount}% on this bundle.`, variant: "success" })
      setCreateOpen(false)
      setBundleName("")
      setDiscountPct("10")
      setSelectedIds([])
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setCreating(false) }
  }

  const handleDelete = async (bundleId: string) => {
    setDeleting(bundleId)
    try {
      await AdminService.deleteDoc("bundles", bundleId)
      toast({ title: "Bundle deleted", variant: "success" })
    } catch {
      toast({ title: "Could not delete bundle", variant: "destructive" })
    } finally { setDeleting(null) }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Bundle Deals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Group listings together at a discount to increase sales.
          </p>
        </div>
        <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Bundle
        </Button>
      </div>

      {/* Existing bundles */}
      {bundles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Package className="h-14 w-14 mx-auto text-muted-foreground/30" />
            <p className="font-semibold text-secondary">No bundles yet</p>
            <p className="text-sm text-muted-foreground">Create your first bundle deal to boost sales.</p>
            <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {bundles.map(bundle => (
            <Card key={bundle.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base line-clamp-1">{bundle.name}</CardTitle>
                  <Badge className="bg-emerald-100 text-emerald-800 shrink-0">
                    <Percent className="h-3 w-3 mr-1" />{bundle.discountPercent}% OFF
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Thumbnails */}
                <div className="flex gap-1.5">
                  {bundle.listingImages?.slice(0, 4).map((img: string | null, i: number) => (
                    <div key={i} className="relative w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                      {img
                        ? <Image src={img} alt="" fill className="object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">?</div>
                      }
                    </div>
                  ))}
                  {bundle.listingIds?.length > 4 && (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0">
                      +{bundle.listingIds.length - 4}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xl font-bold text-primary">{formatPrice(bundle.bundlePrice)}</p>
                    <p className="text-xs text-muted-foreground line-through">{formatPrice(bundle.originalPrice)}</p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-1 rounded-md">
                    Save {formatPrice(bundle.saving)}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  {bundle.listingIds?.length} items · {bundle.listingTitles?.join(", ").slice(0, 60)}...
                </p>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50 w-full"
                  onClick={() => handleDelete(bundle.id)}
                  disabled={deleting === bundle.id}
                >
                  {deleting === bundle.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Bundle</>
                  }
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Bundle Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Create Bundle Deal
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>Bundle Name</Label>
              <Input
                placeholder="e.g., Photography Starter Kit"
                value={bundleName}
                onChange={e => setBundleName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Discount (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={80}
                  value={discountPct}
                  onChange={e => setDiscountPct(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">off total price (max 80%)</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Select Items <span className="text-muted-foreground font-normal">(min 2)</span></Label>
              {myListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active listings found.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {myListings.map(listing => {
                    const selected = selectedIds.includes(listing.id)
                    return (
                      <button
                        key={listing.id}
                        onClick={() => toggleSelect(listing.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-colors text-left ${
                          selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted shrink-0">
                          {listing.images?.[0] && (
                            <Image src={listing.images[0]} alt="" fill className="object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{listing.title}</p>
                          <p className="text-xs text-primary font-semibold">{formatPrice(listing.priceSale || 0)}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selected ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Live price preview */}
            {selectedIds.length >= 1 && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold">Bundle Preview</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original total ({selectedIds.length} items)</span>
                  <span>{formatPrice(originalTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount ({discount}%)</span>
                  <span className="text-red-500">-{formatPrice(saving)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Bundle Price</span>
                  <span className="text-primary">{formatPrice(bundlePrice)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={handleCreate}
              disabled={creating || selectedIds.length < 2 || !bundleName.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Tag className="h-3.5 w-3.5 mr-1.5" /> Create Bundle</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
