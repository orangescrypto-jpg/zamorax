"use client"

import { AdminService, where, serverTimestamp } from "@/src/services"
import { useState, useEffect } from "react"
import { useAuthStore } from "@/store/authStore"
import { BoostCard } from "@/components/boost/BoostCard"
import { useToast } from "@/components/ui/use-toast"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Sparkles, TrendingUp, Eye, Zap, Gift, ArrowUpRight, Megaphone, Globe } from "lucide-react"
import Link from "next/link"
import {
  checkAdBoostEnabled,
  checkProductEligibility,
  createAdBoost,
  getActiveBoosts,
  cancelAdBoost,
  formatAdBoostPrice,
  FeatureDisabledError,
  type AdBoost,
  type AdBoostPlanType,
} from "@/src/services/adBoostService"
import { PaymentService } from "@/src/services/payment"
import { ManualPaymentInstructions } from "@/components/payment/ManualPaymentInstructions"
import type { BankDetails } from "@/src/types/payment"

// Free monthly boost credits per plan
const PLAN_FREE_CREDITS: Record<string, number> = { free: 0, starter: 1, pro: 3 }

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function BoostCenterPage() {
  const user = useAuthStore((s) => s.user)
  const uid = user?.uid
  const { toast } = useToast()
  const { settings } = usePlatformSettings()

  // Boost plans driven by platform settings so admin can change prices and durations
  const BOOST_PLANS = [
    {
      title: "Standard",
      price: settings.boostStandard,
      durationDays: settings.boostStandardDays,
      duration: `${settings.boostStandardDays} day${settings.boostStandardDays !== 1 ? "s" : ""}`,
      description: "3× more views. Appear higher in category search results.",
    },
    {
      title: "Premium",
      price: settings.boostPremium,
      durationDays: settings.boostPremiumDays,
      duration: `${settings.boostPremiumDays} day${settings.boostPremiumDays !== 1 ? "s" : ""}`,
      description: "8× more views. Featured badge + homepage exposure.",
    },
    {
      title: "Category Top",
      price: settings.boostCategoryTop,
      durationDays: settings.boostCategoryTopDays,
      duration: `${settings.boostCategoryTopDays} day${settings.boostCategoryTopDays !== 1 ? "s" : ""}`,
      description: "Pin your listing to the top of its category.",
    },
  ]

  // Ad Boost plans — prices from platformSettings (never hardcoded)
  const AD_BOOST_PLANS = [
    {
      planType: "ad" as AdBoostPlanType,
      title: "Ad Boost",
      price: settings.adBoostPriceStandard,
      duration: `${settings.adBoostCampaignDurationDays} days`,
      description: "External Google Ads + Instagram, Facebook, TikTok & X campaigns.",
      platforms: ["google", "instagram", "facebook", "tiktok", "twitter"],
      icon: Globe,
    },
    {
      planType: "combined" as AdBoostPlanType,
      title: "Combined Boost",
      price: settings.adBoostPriceCombined,
      duration: `${settings.adBoostCampaignDurationDays} days`,
      description: "Internal feed boost + full external ad campaign. Best value.",
      platforms: ["google", "instagram", "facebook", "tiktok", "twitter"],
      icon: Megaphone,
    },
  ]

  const [listings, setListings] = useState<any[]>([])
  const [activeBoosts, setActiveBoosts] = useState<any[]>([])
  const [activeAdBoosts, setActiveAdBoosts] = useState<AdBoost[]>([])
  const [selectedListing, setSelectedListing] = useState("")
  const [selectedPlan, setSelectedPlan] = useState("")
  const [selectedAdPlan, setSelectedAdPlan] = useState<AdBoostPlanType | "">("")
  const [adBoostPayment, setAdBoostPayment] = useState<{
    adBoostId: string
    reference: string
    amount: number
    bankDetails: BankDetails | null
  } | null>(null)
  const [boostPayment, setBoostPayment] = useState<{
    boostId: string
    reference: string
    amount: number
    bankDetails: BankDetails | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [adBoostAvailable, setAdBoostAvailable] = useState(false)
  const [eligibilityChecking, setEligibilityChecking] = useState(false)
  const [eligibilityResult, setEligibilityResult] = useState<{
    eligible: boolean; reasons: string[]
  } | null>(null)

  // Free credit tracking — read from user doc
  const plan = user?.plan ?? "free"
  const totalFreeCredits = PLAN_FREE_CREDITS[plan] ?? 0
  const usedThisMonth: number = (() => {
    const monthKey = currentMonthKey()
    const stored = (user as any)?.boostCreditsResetMonth
    if (stored !== monthKey) return 0
    return (user as any)?.boostCreditsUsed ?? 0
  })()
  const freeCreditsLeft = Math.max(0, totalFreeCredits - usedThisMonth)

  useEffect(() => {
    if (!uid) return

    // Check if Ad Boost feature is enabled
    checkAdBoostEnabled()
      .then(() => setAdBoostAvailable(true))
      .catch(() => setAdBoostAvailable(false))

    const unsubListings = AdminService.subscribeToCollection(
      "listings",
      (snap) => { setListings(snap.map((d) => ({ ...d }))); setLoading(false) },
      [where("sellerId", "==", uid), where("status", "==", "active")]
    )

    const unsubBoosts = AdminService.subscribeToCollection(
      "boosts",
      (snap) => setActiveBoosts(snap.map((d) => ({ ...d }))),
      [where("sellerId", "==", uid), where("status", "in", ["active", "pending_payment"])]
    )

    // Ad boosts real-time
    const unsubAdBoosts = AdminService.subscribeToCollection(
      "adBoosts",
      (snap) => setActiveAdBoosts(snap.map((d) => ({ ...d })) as AdBoost[]),
      [where("sellerId", "==", uid), where("status", "in", ["pending", "active", "running"])]
    )

    return () => { unsubListings(); unsubBoosts(); unsubAdBoosts() }
  }, [uid])

  const handleBoost = async () => {
    if (!selectedListing || !selectedPlan) {
      toast({ title: "Select a listing and plan", variant: "destructive" })
      return
    }
    const boostPlan = BOOST_PLANS.find((p) => p.title === selectedPlan)
    if (!boostPlan || !uid || !user?.email) return

    setSubmitting(true)
    try {
      const monthKey = currentMonthKey()
      const usingFreeCredit = freeCreditsLeft > 0

      // If using a free credit, deduct it on the user doc atomically
      if (usingFreeCredit) {
        const storedMonth = (user as any)?.boostCreditsResetMonth
        const newUsed = storedMonth === monthKey ? usedThisMonth + 1 : 1
        await AdminService.updateDoc("users", uid!, {
          boostCreditsUsed: newUsed,
          boostCreditsResetMonth: monthKey,
        })
      }

      // 1. Create the boost doc — only columns that exist on `boosts`:
      // id, listing_id, seller_id, duration, status, payment_reference,
      // payment_provider, activated_at, boost_ends_at, created_at, updated_at.
      // Plan name is folded into `duration` (e.g. "Standard · 7 days") so the
      // day-count regex in /api/payment/confirm still matches, and the list
      // below can still show which plan this was without a dedicated column.
      const durationLabel = `${boostPlan.title} · ${boostPlan.duration}`
      const nowIso = new Date().toISOString()
      const boostEndsAt = new Date(Date.now() + boostPlan.durationDays * 86400000).toISOString()

      const boostRef = await AdminService.addDoc("boosts", {
        sellerId: uid,
        listingId: selectedListing,
        duration: durationLabel,
        status: usingFreeCredit ? "active" : "pending_payment",
        // Free credits never go through /api/payment/confirm, so activate
        // immediately here — mirrors exactly what that route does for paid boosts.
        ...(usingFreeCredit
          ? { paymentReference: "free_credit", activatedAt: nowIso, boostEndsAt }
          : {}),
        createdAt: serverTimestamp(),
      })

      // Free credit — done, no payment needed. Activate the listing boost
      // right away since there's no payment webhook to do it for us.
      if (usingFreeCredit) {
        await AdminService.updateDoc("listings", selectedListing, {
          isBoosted: true,
          boostExpiresAt: boostEndsAt,
        })
        toast({
          title: "Free Boost Applied! 🎉",
          description: `Your ${boostPlan.title} boost is now live (free credit used).`,
          variant: "success",
        })
        setSelectedListing("")
        setSelectedPlan("")
        return
      }

      // 2. Paid boost — initialize payment (manual bank transfer or gateway)
      const paymentResult = await PaymentService.initializePayment({
        purpose: "boost",
        amount: boostPlan.price,
        email: user.email,
        userId: uid,
        metadata: { boostId: boostRef.id, plan: boostPlan.title, listingId: selectedListing },
      })

      // 3. Save the payment reference onto the boost doc (payment_reference column)
      await AdminService.updateDoc("boosts", boostRef.id, {
        paymentReference: paymentResult.reference_code,
      })

      if (paymentResult.redirectUrl) {
        // Gateway (Paystack/Flutterwave) — redirect to checkout
        window.location.href = paymentResult.redirectUrl
        return
      }

      // Manual — show bank transfer instructions inline
      setBoostPayment({
        boostId: boostRef.id,
        reference: paymentResult.reference_code,
        amount: boostPlan.price,
        bankDetails: paymentResult.bankDetails ?? null,
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // Called once the seller submits proof on the manual payment screen
  const handleBoostPaymentSubmitted = () => {
    toast({
      title: "Payment submitted!",
      description: "Your boost is pending admin confirmation. You'll be notified once it's activated.",
      variant: "success",
    })
    setBoostPayment(null)
    setSelectedListing("")
    setSelectedPlan("")
  }

  // Run eligibility check when listing is selected for Ad Boost
  const checkEligibility = async (productId: string) => {
    if (!uid || !productId) return
    setEligibilityChecking(true)
    setEligibilityResult(null)
    const result = await checkProductEligibility(productId, uid)
    if (result.success && result.data) {
      setEligibilityResult({ eligible: result.data.eligible, reasons: result.data.reasons })
    }
    setEligibilityChecking(false)
  }

  const handleAdBoost = async () => {
    if (!selectedListing || !selectedAdPlan || !uid || !user?.email) {
      toast({ title: "Select a listing and Ad Boost plan", variant: "destructive" })
      return
    }
    if (!eligibilityResult?.eligible) {
      toast({ title: "Product not eligible yet", description: "Fix the issues listed below first.", variant: "destructive" })
      return
    }
    const plan = AD_BOOST_PLANS.find(p => p.planType === selectedAdPlan)
    if (!plan) return

    setSubmitting(true)
    try {
      const listing = listings.find(l => l.id === selectedListing)

      // 1. Create the Ad Boost in "pending" status first — gives us an ID to
      //    attach to the payment, and to the admin notification/confirmation flow.
      const createResult = await createAdBoost({
        sellerId:      uid,
        productId:     selectedListing,
        productTitle:  listing?.title ?? "",
        planType:      selectedAdPlan,
        platforms:     plan.platforms as any,
        adCreativeUrl: "",
        paymentRef:    "", // filled in once payment is initialized, below
        amountPaid:    plan.price,
        adSpendBudget: selectedAdPlan === "combined"
          ? settings.adBoostAdSpendCombined
          : settings.adBoostAdSpendStandard,
        marginAmount:  selectedAdPlan === "combined"
          ? settings.adBoostMarginCombined
          : settings.adBoostMarginStandard,
      })

      if (!createResult.success || !createResult.data) {
        throw new Error(createResult.error ?? "Could not create Ad Boost")
      }
      const adBoostId = createResult.data.adBoostId

      // 2. Initialize payment — manual bank transfer for now, but provider-agnostic
      //    so this keeps working unchanged if Paystack/Flutterwave is switched on later.
      const paymentResult = await PaymentService.initializePayment({
        purpose:  "boost",
        amount:   plan.price,
        email:    user.email,
        userId:   uid,
        metadata: { adBoostId, productId: selectedListing, plan: selectedAdPlan },
      })

      // 3. Save the real payment reference onto the Ad Boost doc
      await AdminService.updateDoc("adBoosts", adBoostId, {
        paymentRef: paymentResult.reference_code,
      })

      if (paymentResult.redirectUrl) {
        // Paystack/Flutterwave — redirect straight to checkout
        window.location.href = paymentResult.redirectUrl
        return
      }

      // Manual — show bank transfer instructions inline
      setAdBoostPayment({
        adBoostId,
        reference:   paymentResult.reference_code,
        amount:      plan.price,
        bankDetails: paymentResult.bankDetails ?? null,
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // Called once the seller uploads proof and taps "I've Paid" on the manual instructions
  const handleAdBoostPaymentSubmitted = () => {
    toast({
      title: "Payment submitted!",
      description: "Your Ad Boost is pending admin confirmation. You'll be notified once it's activated.",
      variant: "success",
    })
    setAdBoostPayment(null)
    setSelectedListing("")
    setSelectedAdPlan("")
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

      {/* Free credits banner */}
      {totalFreeCredits > 0 ? (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Gift className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              Free Boosts: {freeCreditsLeft} / {totalFreeCredits} remaining this month
            </p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {plan === "starter" ? "Starter plan includes 1 free boost/month." : "Pro plan includes 3 free boosts/month."}
              {freeCreditsLeft > 0 ? " Your next boost is free — no payment needed." : " You've used all free credits this month."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-muted/40 border rounded-xl px-4 py-3">
          <Gift className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">No free boosts on your current plan</p>
            <p className="text-xs text-muted-foreground mt-0.5">Upgrade to Starter (1/month) or Pro (3/month) to get free boosts.</p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/pricing">Upgrade <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Link>
          </Button>
        </div>
      )}

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
              <CardTitle className="flex items-center justify-between">
                Create a Boost
                {freeCreditsLeft > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                    <Gift className="h-3 w-3 mr-1" /> {freeCreditsLeft} free credit{freeCreditsLeft !== 1 ? "s" : ""} left
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {boostPayment ? (
                <ManualPaymentInstructions
                  amount={boostPayment.amount}
                  reference={boostPayment.reference}
                  bankDetails={boostPayment.bankDetails}
                  userId={uid!}
                  purpose="boost"
                  onConfirmed={handleBoostPaymentSubmitted}
                  loading={submitting}
                />
              ) : (
                <>
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
                  {BOOST_PLANS.map((bp) => {
                    const alreadyBoosted = activeBoosts.some(
                      (b) => b.listingId === selectedListing && String(b.duration ?? "").startsWith(bp.title)
                    )
                    // Show effective price — free if credit available, otherwise paid
                    const effectivePrice = freeCreditsLeft > 0 ? 0 : bp.price
                    return (
                      <BoostCard
                        key={bp.title}
                        {...bp}
                        price={effectivePrice}
                        isActive={alreadyBoosted}
                        isSelected={selectedPlan === bp.title}
                        onSelect={() => !alreadyBoosted && setSelectedPlan(bp.title)}
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
                ) : freeCreditsLeft > 0 ? (
                  <><Gift className="h-4 w-4 mr-2" /> Apply Free Boost</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Boost Now</>
                )}
              </Button>
              {freeCreditsLeft === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {settings.activePaymentProvider === "manual"
                    ? "You'll see bank transfer details on the next step."
                    : "You'll be redirected to complete payment securely."}
                </p>
              )}
                </>
              )}
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
                    <p className="font-medium text-sm line-clamp-1">
                      {listings.find((l) => l.id === b.listingId)?.title || "Listing"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.duration}
                      {b.paymentReference === "free_credit" && (
                        <span className="ml-2 text-emerald-600 font-medium">· Free credit</span>
                      )}
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

      {/* ── Ad Boost Section ────────────────────────────────────────────────── */}
      <div className="border-t pt-8 space-y-6">
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Ad Boost — External Campaigns</h2>
            <p className="text-sm text-muted-foreground">
              Promote your products on Google, Instagram, Facebook, TikTok & X.
            </p>
          </div>
        </div>

        {!adBoostAvailable ? (
          /* Feature gate — show when admin has turned off Ad Boost */
          <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground space-y-3">
            <Megaphone className="h-10 w-10 mx-auto opacity-30" />
            <p className="font-medium">Ad Boost Coming Soon</p>
            <p className="text-sm">
              External ad campaigns are not available yet. Check back later or upgrade your plan.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Ad Boost creator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Create Ad Campaign
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {adBoostPayment ? (
                  <ManualPaymentInstructions
                    amount={adBoostPayment.amount}
                    reference={adBoostPayment.reference}
                    bankDetails={adBoostPayment.bankDetails}
                    userId={uid!}
                    purpose="boost"
                    onConfirmed={handleAdBoostPaymentSubmitted}
                    loading={submitting}
                  />
                ) : (
                  <>
                    {/* Listing selector */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Product</label>
                      {listings.length === 0 ? (
                        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 text-center">
                          No active listings. Post a listing first.
                        </p>
                      ) : (
                        <Select
                          value={selectedListing}
                          onValueChange={v => { setSelectedListing(v); checkEligibility(v) }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a product to advertise…" />
                          </SelectTrigger>
                          <SelectContent>
                            {listings.map(l => (
                              <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Eligibility checker */}
                    {selectedListing && (
                      <div className="space-y-2">
                        {eligibilityChecking ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Checking eligibility…
                          </div>
                        ) : eligibilityResult ? (
                          <div className={`rounded-lg border px-3 py-2.5 text-xs space-y-1 ${
                            eligibilityResult.eligible
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}>
                            <p className="font-semibold">
                              {eligibilityResult.eligible
                                ? "✅ Product eligible for Ad Boost"
                                : "⚠️ Product not yet eligible"
                              }
                            </p>
                            {eligibilityResult.reasons.map(r => (
                              <p key={r} className="pl-1">• {r}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Ad Boost plan cards */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Ad Plan</label>
                      <div className="space-y-3">
                        {AD_BOOST_PLANS.map(ap => (
                          <button
                            key={ap.planType}
                            type="button"
                            onClick={() => setSelectedAdPlan(ap.planType)}
                            className={`w-full text-left rounded-xl border p-4 transition-all ${
                              selectedAdPlan === ap.planType
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <ap.icon className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold">{ap.title}</span>
                              </div>
                              <span className="text-sm font-bold text-primary">
                                {formatAdBoostPrice(ap.price)}<span className="text-xs font-normal text-muted-foreground">/wk</span>
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{ap.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Platforms: {ap.platforms.join(", ")}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-white"
                      onClick={handleAdBoost}
                      disabled={submitting || !selectedListing || !selectedAdPlan || !eligibilityResult?.eligible}
                    >
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</>
                      ) : (
                        <><Megaphone className="h-4 w-4 mr-2" />Launch Ad Campaign</>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      {settings.activePaymentProvider === "manual"
                        ? "You'll see bank transfer details on the next step. Campaign starts next Monday."
                        : "You'll be redirected to complete payment securely. Campaign starts next Monday."}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Active Ad Boosts */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Active Ad Campaigns</h3>
              {activeAdBoosts.length === 0 ? (
                <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground space-y-2">
                  <Globe className="h-8 w-8 mx-auto opacity-40" />
                  <p className="text-sm">No active ad campaigns yet.</p>
                </div>
              ) : (
                activeAdBoosts.map(ab => (
                  <Card key={ab.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm line-clamp-1">{ab.productTitle}</p>
                        <Badge className={
                          ab.status === "running"
                            ? "bg-emerald-100 text-emerald-800"
                            : ab.status === "active"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-amber-100 text-amber-800"
                        }>
                          {ab.status === "running" ? "🟢 Running" : ab.status === "active" ? "Active" : "Pending"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>{ab.planType} · Week {ab.weekNumber} · {ab.platforms?.join(", ")}</p>
                        <p>{formatAdBoostPrice(ab.amountPaid ?? 0)} paid</p>
                      </div>
                      {/* Live stats — shown when running */}
                      {ab.status === "running" && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {[
                            { label: "Impressions", value: (ab.impressions ?? 0).toLocaleString() },
                            { label: "Clicks",      value: (ab.clicks ?? 0).toLocaleString() },
                            { label: "Reach",       value: (ab.reach ?? 0).toLocaleString() },
                          ].map(stat => (
                            <div key={stat.label} className="bg-muted/40 rounded-lg p-2 text-center">
                              <p className="text-xs font-bold">{stat.value}</p>
                              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
