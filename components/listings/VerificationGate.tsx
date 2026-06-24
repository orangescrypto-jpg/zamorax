"use client"

import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldCheck, Clock, CheckCircle, Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

export function VerificationGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { settings } = usePlatformSettings()

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  // ── Fully approved (NIN verified by admin) → allow posting
  if (user?.ninVerified) return <>{children}</>

  // ── NIN submitted, pending admin review
  if (user?.verificationLevel === "nin") {
    return (
      <div className="container max-w-md py-12 pb-24">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-amber-900">NIN Under Review</h2>
              <p className="text-sm text-amber-700 mt-2">
                {settings.verificationReviewMessage ||
                  `Your NIN has been submitted and is being reviewed by our team. You'll be able to post listings once approved.`}
                {settings.verificationReviewSlaHours > 0 && (
                  <> Usually within <strong>{settings.verificationReviewSlaHours} hours</strong>.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 justify-center text-sm">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-amber-700">NIN — Pending review</span>
            </div>
            <div className="bg-white rounded-lg p-3 text-xs text-amber-800 border border-amber-200">
              💡 While you wait, set up your{" "}
              <Link href="/dashboard/seller/store" className="underline font-medium">store profile</Link>.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── NIN submission closed
  if (!settings.acceptNewNinSubmissions) {
    return (
      <div className="container max-w-md py-12 pb-24">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold text-amber-900">Verification Temporarily Unavailable</h2>
              <p className="text-sm text-amber-700 mt-2">
                NIN submission is temporarily paused. Please check back soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── NIN not yet submitted
  return (
    <div className="container max-w-md py-12 pb-24">
      <Card className="border-red-200">
        <CardContent className="p-6 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold">Verify Your NIN First</h2>
            <p className="text-sm text-muted-foreground mt-2">
              All sellers must verify their <strong>NIN</strong> before posting listings. This protects buyers and keeps Zamorax safe.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-red-400 shrink-0" />
            <span className="text-sm">NIN (National Identity Number)</span>
            <span className="ml-auto text-xs font-medium text-red-500">Required</span>
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-xs text-left space-y-1.5">
            <p className="font-semibold text-primary">Why we require this:</p>
            {["Protects buyers from fraud", "Gives your listings a verified badge", "Enables escrow-protected payments"].map(b => (
              <div key={b} className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-primary shrink-0" /> {b}
              </div>
            ))}
          </div>

          <Button asChild className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base">
            <Link href="/dashboard/seller/store">
              <ShieldCheck className="h-5 w-5 mr-2" /> Submit My NIN
            </Link>
          </Button>

          {settings.acceptNewBvnSubmissions && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Want more features? Upgrade to Pro</p>
              <Button asChild variant="outline" size="sm" className="w-full border-primary/30 text-primary">
                <Link href="/pricing">
                  Pro: BVN + Selfie Verification <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
