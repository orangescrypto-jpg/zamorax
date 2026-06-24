"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ShieldCheck, Store, BadgeCheck, TrendingUp,
  Wallet, ChevronRight, Loader2, CreditCard, Info,
} from "lucide-react"
import { UpgradeToSellerForm } from "@/components/dashboard/UpgradeToSellerForm"
import { useState } from "react"

type Plan = "free" | "starter" | "pro"
const benefits = [
  {
    icon: <Store className="h-6 w-6 text-primary" />,
    title: "List Products & Services",
    desc: "Post listings for phones, clothes, cars, properties & more.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6 text-green-600" />,
    title: "Verified Identity Badge",
    desc: "Earn buyer trust with a verified badge on all your listings.",
  },
  {
    icon: <Wallet className="h-6 w-6 text-primary" />,
    title: "Escrow-Protected Payments",
    desc: "Get paid securely. Funds released when buyers confirm delivery.",
  },
  {
    icon: <TrendingUp className="h-6 w-6 text-primary" />,
    title: "Reach Millions of Buyers",
    desc: "Access a growing marketplace of verified Nigerian buyers.",
  },
]

export default function BecomeSellerPage() {
  const { user, loading, isSeller } = useAuth()
  const { settings } = usePlatformSettings()
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<Plan>("free")
  const [showForm, setShowForm] = useState(false)

  const s = settings
  const fmt = (kobo: number) => "₦" + (kobo / 100).toLocaleString()
  const plans = [
    {
      key: "free" as Plan,
      name: "Free",
      price: "₦0",
      listings: `${s.planFreeListingLimit ?? 5} listings`,
      badge: "NIN-verified badge",
      verifies: "NIN only",
      borderClass: "border-border",
    },
    {
      key: "starter" as Plan,
      name: "Starter",
      price: `${fmt(s.planStarterPrice * 100)}/mo`,
      listings: s.planStarterListingLimit > 0 ? `${s.planStarterListingLimit} listings` : "Unlimited",
      badge: "Verified Badge",
      verifies: "BVN + Selfie",
      borderClass: "border-primary bg-primary/5",
      tag: "Popular",
    },
    {
      key: "pro" as Plan,
      name: "Pro",
      price: `${fmt(s.planProPrice * 100)}/mo`,
      listings: s.planProListingLimit === 0 ? "Unlimited" : `${s.planProListingLimit} listings`,
      badge: "Gold Badge + Priority Support",
      verifies: "BVN + Selfie",
      borderClass: "border-amber-400 bg-amber-50",
    },
  ]

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (user && isSeller()) { router.replace("/dashboard/seller"); return null }

  // ── Show the right verification form based on chosen plan ──
  if (showForm) {
    return (
      <main className="container max-w-lg py-8 pb-24">
        <UpgradeToSellerForm
          plan={selectedPlan}
          onBack={() => setShowForm(false)}
        />
      </main>
    )
  }

  const chosen = plans.find((p) => p.key === selectedPlan)!

  return (
    <main className="container max-w-2xl py-8 pb-24 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-2">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-secondary">
          Become a Seller on Zamorax
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Join thousands of verified Nigerian sellers. Start listing for free — no upfront cost.
        </p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 gap-3">
        {benefits.map((b, i) => (
          <Card key={i}>
            <CardContent className="flex items-start gap-4 p-4">
              <div className="mt-0.5 shrink-0">{b.icon}</div>
              <div>
                <p className="font-semibold text-sm text-secondary">{b.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan selector */}
      <div className="space-y-2">
        <h2 className="font-semibold text-secondary">Choose Your Plan</h2>
        {plans.map((p) => {
          const isSelected = selectedPlan === p.key
          return (
            <button
              key={p.key}
              onClick={() => setSelectedPlan(p.key)}
              className={`w-full text-left flex items-center justify-between p-4 rounded-xl border-2 transition ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : p.borderClass
              }`}
            >
              <div className="space-y-0.5">
                <p className="font-bold text-sm">
                  {p.name} —{" "}
                  <span className="text-primary">{p.price}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.listings}
                  {p.badge ? ` · ${p.badge}` : ""}
                </p>
                {/* Verification requirement label */}
                <div className="flex items-center gap-1 mt-1">
                  {p.key === "free"
                    ? <ShieldCheck className="h-3 w-3 text-green-500" />
                    : <CreditCard className="h-3 w-3 text-blue-500" />}
                  <span className="text-[10px] text-muted-foreground">
                    Requires: {p.verifies}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.tag && !isSelected && (
                  <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                    {p.tag}
                  </span>
                )}
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <BadgeCheck className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
        <p className="text-xs text-muted-foreground text-center pt-1">
          You can upgrade your plan anytime from your seller dashboard.
        </p>
      </div>

      {/* What happens next — contextual hint */}
      <Card className={
        selectedPlan === "free"
          ? "border-green-200 bg-green-50"
          : selectedPlan === "pro"
            ? "border-amber-200 bg-amber-50"
            : "border-primary/20 bg-primary/5"
      }>
        <CardContent className="p-4 flex items-start gap-3">
          <Info className={`h-4 w-4 shrink-0 mt-0.5 ${
            selectedPlan === "free" ? "text-green-600"
            : selectedPlan === "pro" ? "text-amber-600"
            : "text-primary"
          }`} />
          <div className="text-sm space-y-0.5">
            <p className="font-semibold">
              {selectedPlan === "free"
                ? "What happens next (Free)"
                : selectedPlan === "starter"
                  ? "What happens next (Starter)"
                  : "What happens next (Pro)"}
            </p>
            {selectedPlan === "free" ? (
              <p className="text-xs text-muted-foreground">
                Submit your <strong>NIN</strong>. Our team reviews it within 24 hours.
                Once approved, you can start posting up to 5 listings immediately.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Payment is processed first, then you submit your <strong>BVN + selfie</strong> for
                verification. Your {selectedPlan === "pro" ? "Gold" : "Verified"} badge activates
                within 24 hours of approval.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="space-y-3 pt-2">
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base"
          onClick={() => {
            if (!user) {
              router.push("/register")
              return
            }
            // Paid plans: go to payment first, then redirect back to upgrade-verify
            if (selectedPlan !== "free") {
              router.push(`/pricing?plan=${selectedPlan}&redirect=/dashboard/seller/upgrade-verify`)
              return
            }
            // Free: show NIN form inline
            setShowForm(true)
          }}
        >
          {!user
            ? "Register to Become a Seller"
            : selectedPlan === "free"
              ? "Continue — Submit NIN"
              : `Continue — Pay for ${chosen.name} Plan`}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" className="w-full" onClick={() => router.back()}>
          Maybe Later
        </Button>
      </div>
    </main>
  )
}
