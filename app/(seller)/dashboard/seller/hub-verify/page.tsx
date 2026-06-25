"use client"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(seller)/dashboard/seller/hub-verify/page.tsx
// Seller requests hub verification for a specific listing (₦1,000 per item)

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ShieldCheck, Package, Loader2, CheckCircle, Clock, AlertCircle, Info } from "lucide-react"
import Image from "next/image"
import {DocumentData} from "@/src/services"

type Listing = DocumentData & { id: string }
type HubRequest = DocumentData & { id: string }

export default function HubVerifyPage() {
  const uid = useAuthStore(s => s.user?.uid)
  const { user } = useAuth()
  const { toast } = useToast()
  const [listings, setListings] = useState<Listing[]>([])
  const [hubRequests, setHubRequests] = useState<HubRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmListing, setConfirmListing] = useState<Listing | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!uid) return
    const unsubs: (() => void)[] = []

    unsubs.push(AdminService.subscribeToCollection("listings", docs => { setListings(docs.map((d: any) => ({ id: d.id, ...d.data() }))); setLoading(false) }, [where("status", "==", "active")]))
    unsubs.push(AdminService.subscribeToCollection("hubVerificationRequests", docs => setHubRequests(docs.map((d: any) => ({ ...d }))), [where("sellerId", "==", uid)]))
    return () => unsubs.forEach(u => u())
  }, [uid])

  const getRequestStatus = (listingId: string) =>
    hubRequests.find(r => r.listingId === listingId)?.status || null

  const handleRequest = async () => {
    if (!confirmListing || !uid || !user) return
    setSubmitting(true)
    try {
      await AdminService.addDoc("hubVerificationRequests", {
        listingId: confirmListing.id,
        listingTitle: confirmListing.title,
        listingImage: confirmListing.images?.[0] || null,
        sellerId: uid,
        sellerName: user.fullName,
        sellerEmail: user.email,
        status: "pending",
        fee: 100000, // ₦1,000 in kobo
        createdAt: serverTimestamp(),
      })
      toast({
        title: "Hub Verification Requested ✅",
        description: "Admin will inspect and verify your item within 48hrs.",
        variant: "success",
      })
      setConfirmListing(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="container max-w-3xl py-8 pb-24 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-accent" /> Hub Verification
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Get a verified badge on your listing. Buyers trust Hub Verified items 3× more.
        </p>
      </div>

      {/* Info card */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-secondary">What is Hub Verification?</p>
              <p className="text-muted-foreground">Our team physically inspects and tests your item, records a verification video, and adds a <strong>Hub Verified</strong> badge to your listing. This significantly increases buyer confidence and conversion.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Physical inspection", "Video verification", "Hub Verified badge", "Priority in search"].map(f => (
                  <span key={f} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> {f}
                  </span>
                ))}
              </div>
              <p className="font-semibold text-accent">Fee: {formatPrice(100000)} per listing (one-time)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listings */}
      {listings.length === 0 ? (
        <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No active listings to verify.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Your Active Listings</h2>
          {listings.map(listing => {
            const status = getRequestStatus(listing.id)
            const isVerified = listing.isHubVerified

            return (
              <Card key={listing.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0 relative">
                    {listing.images?.[0]
                      ? <Image src={listing.images[0]} alt="" fill className="object-cover" />
                      : <Package className="h-6 w-6 m-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{listing.title}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(listing.priceSale || 0)}</p>
                  </div>

                  {isVerified ? (
                    <Badge className="bg-accent/10 text-accent border-accent/30 flex items-center gap-1 shrink-0">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verified
                    </Badge>
                  ) : status === "pending" ? (
                    <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1 shrink-0">
                      <Clock className="h-3.5 w-3.5" /> Pending
                    </Badge>
                  ) : status === "rejected" ? (
                    <Badge className="bg-red-100 text-red-800 flex items-center gap-1 shrink-0">
                      <AlertCircle className="h-3.5 w-3.5" /> Rejected
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-accent hover:bg-accent/90 text-white shrink-0"
                      onClick={() => setConfirmListing(listing)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Request
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={!!confirmListing} onOpenChange={() => setConfirmListing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Hub Verification</DialogTitle>
            <DialogDescription>
              You're requesting verification for <strong>{confirmListing?.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between p-3 bg-muted/40 rounded-lg">
              <span className="text-muted-foreground">Verification Fee</span>
              <span className="font-bold text-accent">{formatPrice(100000)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Our team will contact you within 24hrs to arrange inspection. Fee is collected after verification is confirmed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmListing(null)}>Cancel</Button>
            <Button
              className="bg-accent hover:bg-accent/90 text-white"
              onClick={handleRequest}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
