"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useFeeSettings } from "@/hooks/useFeeSettings"
import { PlanCard } from "@/components/subscription/PlanCard"
import { FeeCalculator } from "@/components/subscription/FeeCalculator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"

function fmt(n: number) { return "₦" + n.toLocaleString() }
// commissionSale/commissionRental stored as whole % (e.g. 4 = 4%)
function pct(n: number) { return n.toFixed(1) + "%" }

// Resolve the correct CTA href based on auth + current plan
function resolveHref(
  planKey: "free" | "starter" | "pro",
  isAuthenticated: boolean,
  isSeller: boolean,
  currentPlan: string | undefined
): { href: string; cta: string; disabled: boolean } {
  // Not logged in → register flow
  if (!isAuthenticated) {
    if (planKey === "free") return { href: "/register", cta: "Get Started Free", disabled: false }
    return { href: `/register?plan=${planKey}`, cta: planKey === "starter" ? "Start Starter Plan" : "Go Pro", disabled: false }
  }

  // Already on this plan
  if (currentPlan === planKey) {
    return { href: "#", cta: "✓ Current Plan", disabled: true }
  }

  // Free plan while logged in
  if (planKey === "free") {
    return { href: "/dashboard/seller", cta: "Go to Dashboard", disabled: false }
  }

  // Logged in but not yet a seller
  if (!isSeller) {
    return { href: `/dashboard/become-seller?plan=${planKey}`, cta: planKey === "starter" ? "Start Starter Plan" : "Go Pro", disabled: false }
  }

  // Already a seller — upgrade flow
  return {
    href: `/dashboard/seller/upgrade-verify?plan=${planKey}`,
    cta: planKey === "starter" ? "Upgrade to Starter" : "Upgrade to Pro",
    disabled: false,
  }
}

export default function PricingPage() {
  const { settings } = usePlatformSettings()
  const { fees }     = useFeeSettings()
  const { user, isAuthenticated, isSeller } = useAuth()

  const loggedIn   = isAuthenticated()
  const sellerUser = isSeller()
  const plan       = user?.plan

  // p = platform settings shorthand
  const p = settings

  function billingLabel(months: number) {
    if (months === 1)  return "month"
    if (months === 3)  return "quarter"
    if (months === 12) return "year"
    return `${months} months`
  }

  const plans = [
    {
      name: "Free", price: "₦0", period: "forever",
      planKey: "free" as const,
      badge: p.planFreeLabel || null,
      features: [
        `${p.planFreeListingLimit ?? 5} active listings`,
        "Basic seller badge",
        "Standard email support",
        `${pct(fees.commissionSale)} sales commission`,
        `${pct(fees.commissionRental)} rental commission`,
      ],
      variant: "outline" as const,
    },
    {
      name: "Starter",
      price: fmt(p.planStarterPrice),
      period: billingLabel(p.planStarterBillingMonths),
      planKey: "starter" as const,
      badge: p.planStarterLabel || null,
      features: [
        p.planStarterListingLimit > 0
          ? `${p.planStarterListingLimit} active listings`
          : "Unlimited active listings",
        "Verified Store badge",
        "Basic analytics dashboard",
        `${p.planStarterFreeBoosts} free boost${p.planStarterFreeBoosts !== 1 ? "s" : ""}/${billingLabel(p.planStarterBillingMonths)}`,
        "Priority email support",
        "Early feature access",
      ],
      variant: "default" as const,
    },
    {
      name: "Pro",
      price: fmt(p.planProPrice),
      period: billingLabel(p.planProBillingMonths),
      planKey: "pro" as const,
      badge: p.planProLabel || null,
      features: [
        p.planProListingLimit === 0
          ? "Unlimited active listings"
          : `${p.planProListingLimit} active listings`,
        "Pro Seller gold badge",
        "Full analytics & reports",
        `${p.planProFreeBoosts} free boost${p.planProFreeBoosts !== 1 ? "s" : ""}/${billingLabel(p.planProBillingMonths)}`,
        "Priority WhatsApp support",
        "Dedicated account manager",
      ],
      variant: "secondary" as const,
    },
  ]

  const boosts = [
    {
      name: p.boostStandardLabel    || "Standard",
      price: fmt(p.boostStandard),
      days: p.boostStandardDays,
      desc: p.boostStandardDesc,
    },
    {
      name: p.boostPremiumLabel     || "Premium",
      price: fmt(p.boostPremium),
      days: p.boostPremiumDays,
      desc: p.boostPremiumDesc,
    },
    {
      name: p.boostCategoryTopLabel || "Category Top",
      price: fmt(p.boostCategoryTop),
      days: p.boostCategoryTopDays,
      desc: p.boostCategoryTopDesc,
    },
  ]

  return (
    <div className="container py-12 space-y-16">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-heading font-bold">Grow Your Sales on Zamorax</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Transparent pricing. No hidden fees. Scale your business from day one.
        </p>

        {/* Current plan banner for logged-in sellers */}
        {loggedIn && plan && (
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-1.5 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            You are on the <strong className="capitalize">{plan}</strong> plan
          </div>
        )}

        {!loggedIn && (
          <div className="flex justify-center gap-3">
            <Button asChild size="lg"><Link href="/register">Create Free Account</Link></Button>
            <Button variant="outline" size="lg" asChild><Link href="/how-it-works">How It Works</Link></Button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-heading font-bold mb-6 text-center">Choose Your Seller Plan</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((planItem) => {
            const { href, cta, disabled } = resolveHref(planItem.planKey, loggedIn, sellerUser, plan)
            return (
              <PlanCard
                key={planItem.name}
                {...planItem}
                cta={cta}
                href={href}
                disabled={disabled}
              />
            )
          })}
        </div>
      </section>

      <section className="bg-muted/30 rounded-2xl p-8 space-y-6">
        <h2 className="text-2xl font-heading font-bold text-center">Boost Add-ons (Pay-As-You-Go)</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {boosts.map(b => (
            <div key={b.name} className="p-4 bg-background border rounded-lg flex flex-col gap-1">
              <h3 className="font-semibold">{b.name}</h3>
              <p className="text-primary font-bold text-lg">{b.price} / {b.days} day{b.days !== 1 ? "s" : ""}</p>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">Hub Verification: {fmt(p.hubVerificationFee)} per item (one-time)</p>
      </section>

      <section className="space-y-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-heading font-bold text-center">Complete Fee Schedule</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 border rounded-lg space-y-2">
            <h3 className="font-medium">Platform Commissions</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex justify-between"><span>Sales Commission</span><span className="font-medium text-foreground">{pct(fees.commissionSale)}</span></li>
              <li className="flex justify-between"><span>Rental Commission</span><span className="font-medium text-foreground">{pct(fees.commissionRental)}</span></li>
              <li className="flex justify-between"><span>Insurance Pool</span><span className="font-medium text-foreground">{pct(fees.insuranceRate)}</span></li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <h3 className="font-medium">Other Fees</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex justify-between"><span>Withdrawal to Bank</span><span className="font-medium text-foreground">{fmt(fees.withdrawalFee / 100)} flat</span></li>
              <li className="flex justify-between"><span>Standard Boost</span><span className="font-medium text-foreground">{fmt(p.boostStandard)}</span></li>
              <li className="flex justify-between"><span>Premium Boost</span><span className="font-medium text-foreground">{fmt(p.boostPremium)}</span></li>
              <li className="flex justify-between"><span>Category Top</span><span className="font-medium text-foreground">{fmt(p.boostCategoryTop)}</span></li>
              <li className="flex justify-between"><span>Hub Verification</span><span className="font-medium text-foreground">{fmt(p.hubVerificationFee)}/item</span></li>
            </ul>
          </div>
        </div>
      </section>

      <FeeCalculator />

      <section className="space-y-4 max-w-2xl mx-auto">
        <h2 className="text-2xl font-heading font-bold text-center">Frequently Asked Questions</h2>
        {[
          { q: "When do I pay the subscription fee?", a: "Fees are billed monthly via Paystack. You'll receive a reminder 3 days before renewal." },
          { q: "Can I switch plans mid-month?", a: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle." },
          { q: "How are withdrawals processed?", a: "Click 'Withdraw' in your dashboard. Funds are sent to your registered Nigerian bank account within 24 hours." },
          { q: "What happens if I don't boost my listings?", a: "Your listings remain visible in search and category grids. Boosts only increase ranking priority." },
        ].map((item, i) => (
          <details key={i} className="border rounded-lg p-4 bg-background group cursor-pointer">
            <summary className="font-medium text-foreground list-none flex justify-between items-center">
              {item.q}
              <span className="text-primary text-lg group-open:rotate-180 transition-transform">+</span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </section>
    </div>
  )
}
