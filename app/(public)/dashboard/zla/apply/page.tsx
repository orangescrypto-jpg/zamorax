"use client"

// app/(public)/dashboard/zla/apply/page.tsx
// UPDATED: No longer hosts the application form.
// Redirects users to ZamoraxLogic.com/become-agent with ref=zamorax_marketplace

import { useAuth } from "@/hooks/useAuth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, CheckCircle, ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

const ZAMORAXLOGIC_URL = process.env.NEXT_PUBLIC_ZAMORAXLOGIC_URL || "https://zamoraxlogic.com"

export default function ZLAApplicationPage() {
  const { user } = useAuth()
  const { settings } = usePlatformSettings()

  const handleApply = () => {
    const ref = "zamorax_marketplace"
    const uid = user?.uid ? `&uid=${user.uid}` : ""
    window.open(`${ZAMORAXLOGIC_URL}/become-agent?ref=${ref}${uid}`, "_blank")
  }

  if (!settings.newZlaRegistrationOpen) {
    return (
      <div className="container max-w-md py-12 text-center space-y-4 pb-24">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/agent">← Back</Link>
        </Button>
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto">
          <Package className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-heading font-bold">Registration Closed</h2>
        <p className="text-sm text-muted-foreground">
          ZLA agent registration is currently closed. Check back soon.
        </p>
      </div>
    )
  }

  return (
    <div className="container max-w-md py-12 space-y-6 pb-24">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dashboard/agent">← Back</Link>
      </Button>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-1">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold">Become a ZLA Agent</h1>
        <p className="text-sm text-muted-foreground">
          Zamorax Logistics Agents earn per parcel received, stored, and dispatched.
          One registration covers both ZamoraxLogic and Zamorax marketplace orders.
        </p>
      </div>

      {/* Earnings preview */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { amount: `₦${(settings.zlaParcelReceivedKobo / 100).toLocaleString("en-NG")}`, label: "Receive parcel" },
          { amount: `₦${(settings.zlaParcelDispatchedKobo / 100).toLocaleString("en-NG")}`, label: "Dispatch" },
          { amount: `₦${(settings.zlaParcelDeliveredKobo / 100).toLocaleString("en-NG")}`, label: "Final delivery" },
        ].map((item: any) => (
          <div key={item.label} className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <p className="text-primary font-bold">{item.amount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Requirements */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">✅ Requirements</p>
          {[
            "Fixed physical address (shop, office, or home)",
            "Available during your stated operating hours",
            "Ability to store up to 20 parcels at a time",
            "Valid phone number for buyer/seller contact",
            "One-time refundable caution fee of ₦5,000",
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* What happens after */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold">📋 What happens next</p>
          {[
            "You register on ZamoraxLogic.com — takes 5 minutes",
            "Our team reviews your application within 48 hours",
            "Once approved, your ZLA dashboard goes live",
            "You receive both ZamoraxLogic and Zamorax marketplace delivery assignments",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="shrink-0 w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CTA */}
      <Button
        className="w-full h-12 bg-primary text-white hover:bg-primary/90 font-semibold"
        onClick={handleApply}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Apply on ZamoraxLogic.com
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You will be taken to ZamoraxLogic.com to complete your registration.
        Your Zamorax marketplace account is separate from your ZamoraxLogic agent account.
      </p>
    </div>
  )
}
