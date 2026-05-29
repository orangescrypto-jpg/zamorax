"use client"

import {AdminService} from "@/src/services"

import { useEffect, useState } from "react"
import { PlanCard } from "@/components/subscription/PlanCard"
import { FeeCalculator } from "@/components/subscription/FeeCalculator"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Prices {
  planStarterPrice: number
  planProPrice: number
  boostStandard: number
  boostPremium: number
  boostCategoryTop: number
  hubVerificationFee: number
  commissionSale: number
  commissionRental: number
  insuranceRate: number
  withdrawalFee: number
}

const DEFAULTS: Prices = {
  planStarterPrice: 1500,
  planProPrice: 3500,
  boostStandard: 500,
  boostPremium: 1500,
  boostCategoryTop: 3000,
  hubVerificationFee: 1000,
  commissionSale: 0.015,
  commissionRental: 0.04,
  insuranceRate: 0.005,
  withdrawalFee: 100,
}

function fmt(n: number) {
  return "₦" + n.toLocaleString()
}

function pct(n: number) {
  return (n * 100).toFixed(1) + "%"
}

export default function PricingPage() {
  const [p, setP] = useState<Prices>(DEFAULTS)

  useEffect(() => {
    AdminService.getDoc("platformSettings", "fees").then(docs => {
      if (docs) setP({ ...DEFAULTS, ...docs as unknown as Prices })
    }).catch(() => {})
  }, [])

  const plans = [
    {
      name: "Free", price: "₦0", period: "forever",
      badge: null,
      features: ["5 active listings", "Basic seller badge", "Standard email support", `${pct(p.commissionSale)} sales commission`, `${pct(p.commissionRental)} rental commission`],
      cta: "Get Started Free", href: "/register", variant: "outline" as const
    },
    {
      name: "Starter", price: fmt(p.planStarterPrice), period: "month",
      badge: "⭐ Most Popular",
      features: ["20 active listings", "Verified Store badge", "Basic analytics dashboard", "1 free boost/month", "Priority email support", "Early feature access"],
      cta: "Start Starter Plan", href: "/register?plan=starter", variant: "default" as const
    },
    {
      name: "Pro", price: fmt(p.planProPrice), period: "month",
      badge: null,
      features: ["Unlimited active listings", "Pro Seller gold badge", "Full analytics & reports", "3 free boosts/month", "Priority WhatsApp support", "Dedicated account manager"],
      cta: "Go Pro", href: "/register?plan=pro", variant: "secondary" as const
    }
  ]

  const boosts = [
    { name: "Standard Boost", price: fmt(p.boostStandard), desc: "7 days visibility boost in search" },
    { name: "Premium Boost", price: fmt(p.boostPremium), desc: "Top 3 placement for 7 days" },
    { name: "Category Top", price: fmt(p.boostCategoryTop), desc: "#1 spot in category for 7 days" }
  ]

  return (
    <div className="container py-12 space-y-16">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-heading font-bold">Grow Your Sales on Zamorax</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Transparent pricing. No hidden fees. Scale your business from day one.</p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg"><Link href="/register">Create Free Account</Link></Button>
          <Button variant="outline" size="lg" asChild><Link href="/how-it-works">How It Works</Link></Button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-heading font-bold mb-6 text-center">Choose Your Seller Plan</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <PlanCard key={plan.name} {...plan} />
          ))}
        </div>
      </section>

      <section className="bg-muted/30 rounded-2xl p-8 space-y-6">
        <h2 className="text-2xl font-heading font-bold text-center">Boost Add-ons (Pay-As-You-Go)</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {boosts.map(b => (
            <div key={b.name} className="p-4 bg-background border rounded-lg flex flex-col gap-1">
              <h3 className="font-semibold">{b.name}</h3>
              <p className="text-primary font-bold text-lg">{b.price} / 7 days</p>
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
              <li className="flex justify-between"><span>Sales Commission</span><span className="font-medium text-foreground">{pct(p.commissionSale)}</span></li>
              <li className="flex justify-between"><span>Rental Commission</span><span className="font-medium text-foreground">{pct(p.commissionRental)}</span></li>
              <li className="flex justify-between"><span>Insurance Pool</span><span className="font-medium text-foreground">{pct(p.insuranceRate)}</span></li>
            </ul>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <h3 className="font-medium">Other Fees</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex justify-between"><span>Withdrawal to Bank</span><span className="font-medium text-foreground">{fmt(p.withdrawalFee)} flat</span></li>
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
          { q: "What happens if I don't boost my listings?", a: "Your listings remain visible in search and category grids. Boosts only increase ranking priority." }
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
