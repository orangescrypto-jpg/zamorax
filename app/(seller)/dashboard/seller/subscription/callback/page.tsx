"use client"
// app/(seller)/dashboard/seller/subscription/callback/page.tsx
// Paystack redirects here after a subscription checkout attempt
// (?reference=...&trxref=...). We look up which subscription this
// reference belongs to (stashed in sessionStorage by
// SubscriptionCheckoutModal before the redirect) and ask the server to
// verify + activate it. Server-side verification is mandatory — we never
// trust query params alone to mean "payment succeeded".

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export default function SubscriptionCallbackPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref")
    if (!reference) {
      setStatus("error")
      setMessage("Missing payment reference.")
      return
    }

    const subscriptionId = sessionStorage.getItem(`zmx_sub_${reference}`)
    if (!subscriptionId) {
      setStatus("error")
      setMessage("Couldn't find this subscription on this device. If payment succeeded, it will still be activated shortly — contact support if it isn't reflected within a few minutes.")
      return
    }

    fetch("/api/subscriptions/activate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ subscriptionId, reference }),
    })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not activate subscription")
        sessionStorage.removeItem(`zmx_sub_${reference}`)
        setStatus("success")
      })
      .catch(err => {
        setStatus("error")
        setMessage(err.message ?? "Something went wrong verifying your payment.")
      })
  }, [params])

  return (
    <div className="container max-w-md py-16 text-center">
      <Card>
        <CardContent className="p-8 space-y-4">
          {status === "verifying" && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <h1 className="text-xl font-heading font-bold">Confirming your payment…</h1>
              <p className="text-sm text-muted-foreground">This only takes a moment.</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <h1 className="text-xl font-heading font-bold">Subscription Activated!</h1>
              <p className="text-sm text-muted-foreground">Your new plan is now live on your seller account.</p>
              <Button asChild className="w-full bg-primary text-white">
                <Link href="/dashboard/seller">Go to Dashboard</Link>
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <XCircle className="h-9 w-9 text-red-600" />
              </div>
              <h1 className="text-xl font-heading font-bold">Couldn't Confirm Payment</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/pricing">Back to Pricing</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
