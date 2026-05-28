"use client"

import { AdminService , where , serverTimestamp } from "@/src/services"

import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { BoostCard } from "@/components/boost/BoostCard"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Sparkles, TrendingUp, Eye, Zap } from "lucide-react"
import { addDoc } from "@/src/services"

const BOOST_PLANS = [
  {
    title: "Standard",
    price: 50000,
    duration: "7 days",
    description: "3× more views. Appear higher in category search results.",
  },
  {
    title: "Premium",
    price: 150000,
    duration: "14 days",
    description: "8× more views. Featured badge + homepage exposure.",
  },
  {
    title: "Category Top",
    price: 300000,
    duration: "7 days",
    description: "Pin your listing to the top of its category for a full week.",
  },
]

export default function BoostCenterPage() {
  const uid = useAuthStore((s) => s.user?.uid)
  const { toast } = useToast()

  const [listings, setListings] = useState<any[]>([])
  const [activeBoosts, setActiveBoosts] = useState<any[]>([])
  const [selectedListing, setSelectedListing] = useState("")
  const [selectedPlan, setSelectedPlan] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!uid) return

    // Fetch seller's active listings
    const unsubListings = AdminService.subscribeToCollection("listings", (snap) => {
        setListings(docs.map((d) => ({ ...d })))
        setLoading(false)
      }, [where("status", "==", "active")])

    // Fetch active boosts
    const unsubBoosts = AdminService.subscribeToCollection("boosts", (snap) => setActiveBoosts(docs.map((d) => ({ ...d }))), [where("isActive", "==", true)])

    return () => {
      unsubListings()
      unsubBoosts()
    }
  }, [uid])

  const handleBoost = async () => {
    if (!selectedListing || !selectedPlan) {
      toast({ title: "Select a listing and plan", variant: "destructive" })
      return
    }
    const plan = BOOST_PLANS.find((p) => p.title === selectedPlan)
    if (!plan) return

    setSubmitting(true)
    try {
      await AdminService.addDoc("boosts", {
        sellerId: uid,
        listingId: selectedListing,
        listingTitle: listings.find((l) => l.id === selectedListing)?.title || "",
        plan: plan.title,
        price: plan.price,
        duration: plan.duration,
        isActive: true,
        status: "pending_payment",
        createdAt: serverTimestamp(),
      })
      toast({
        title: "Boost Requested!",
        description: `Your ${plan.title} boost has been submitted. Complete payment to activate.`,
        variant: "success",
      })
      setSelectedListing("")
      setSelectedPlan("")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading)
    return (
      <div className="container flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> Boost Center
        </h1>
        <p className="text-muted-foreground mt-1">
          Boost your listings to get more visibility, more buyers, and faster sales.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Active Boosts</p>
              <p className="text-xl font-bold">{activeBoosts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Eye className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Boosted Views</p>
              <p className="text-xl font-bold">
                {activeBoosts.reduce((a, b) => a + (b.views || 0), 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Active Listings</p>
              <p className="text-xl font-bold">{listings.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Create a Boost */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create a Boost</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Listing selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Listing</label>
                {listings.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                    No active listings found. Post a listing first.
                  </p>
                ) : (
                  <Select value={selectedListing} onValueChange={setSelectedListing}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a listing to boost..." />
                    </SelectTrigger>
                    <SelectContent>
                      {listings.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Boost plans */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Plan</label>
                <div className="space-y-3">
                  {BOOST_PLANS.map((plan) => {
                    const alreadyBoosted = activeBoosts.some(
                      (b) => b.listingId === selectedListing && b.plan === plan.title
                    )
                    return (
                      <BoostCard
                        key={plan.title}
                        {...plan}
                        isActive={alreadyBoosted}
                        isSelected={selectedPlan === plan.title}
                        onSelect={() => !alreadyBoosted && setSelectedPlan(plan.title)}
                      />
                    )
                  })}
                </div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-white"
                onClick={handleBoost}
                disabled={submitting || !selectedListing || !selectedPlan}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Boost Now</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Active Boosts */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Active Boosts</h2>
          {activeBoosts.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground space-y-2">
              <Sparkles className="h-8 w-8 mx-auto opacity-40" />
              <p>No active boosts yet.</p>
              <p className="text-sm">Select a plan on the left to get started.</p>
            </div>
          ) : (
            activeBoosts.map((b) => (
              <Card key={b.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm line-clamp-1">{b.listingTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.plan} · {b.duration}
                    </p>
                  </div>
                  <Badge
                    className={
                      b.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }
                  >
                    {b.status === "active" ? "Live" : "Pending Payment"}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
