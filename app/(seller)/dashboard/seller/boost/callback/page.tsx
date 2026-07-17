"use client"
// app/(seller)/dashboard/seller/boost/callback/page.tsx
// Paystack/Flutterwave redirects here after a boost or ad-boost checkout
// attempt (?reference=...&trxref=... or ?ref=... for Flutterwave). We look
// up which boost/adBoost this reference belongs to (stashed in
// sessionStorage by the boost page before the redirect) and ask the server
// to verify + activate it. Server-side verification is mandatory — we never
// trust query params alone to mean "payment succeeded".

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export default function BoostCallbackPage() {
  const params = useSearchParams()
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [message, setMessage] = useState("")

  useEffect(() => {
    // Paystack: ?reference=...&trxref=...
    // Flutterwave: ?status=...&tx_ref=...&transaction_id=...
    const flwTxRef  = params.get("tx_ref")
    const flwTxId   = params.get("transaction_id")
    const flwStatus = params.get("status")
    const paystackReference = params.get("reference") || params.get("trxref") || params.get("ref")

    const isFlutterwave = !!flwTxRef || !!flwTxId
    const reference = isFlutterwave ? flwTxRef : paystackReference

    if (!reference) {
      setStatus("error")
      setMessage("Missing payment reference.")
      return
    }

    // Flutterwave includes a status param up front — if the user cancelled
    // or it failed outright, don't even bother calling the server.
    if (isFlutterwave && flwStatus && flwStatus !== "successful" && flwStatus !== "completed") {
      setStatus("error")
      setMessage("Payment was not completed.")
      sessionStorage.removeItem(`zmx_boost_${reference}`)
      return
    }

    const stashed = sessionStorage.getItem(`zmx_boost_${reference}`)
    if (!stashed) {
      setStatus("error")
      setMessage("Couldn't find this boost on this device. If payment succeeded, it will still be activated shortly — contact support if it isn't reflected within a few minutes.")
      return
    }

    const { boostId, adBoostId, provider } = JSON.parse(stashed)

    fetch("/api/boosts/activate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        boostId, adBoostId, provider,
        reference,
        // For Flutterwave, verification is done by transaction_id (more
        // reliable than verify-by-reference), so pass it through separately.
        transactionId: isFlutterwave ? flwTxId : undefined,
      }),
    })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not activate boost")
        sessionStorage.removeItem(`zmx_boost_${reference}`)
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
              <h1 className="text-xl font-heading font-bold">Boost Activated!</h1>
              <p className="text-sm text-muted-foreground">Your listing is now boosted.</p>
              <Button asChild className="w-full bg-primary text-white">
                <Link href="/dashboard/seller/boost">Back to Boost</Link>
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
                <Link href="/dashboard/seller/boost">Back to Boost</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
