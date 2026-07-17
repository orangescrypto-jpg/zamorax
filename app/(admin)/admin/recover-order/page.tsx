"use client"

// app/(admin)/admin/recover-order/page.tsx
// Simple form UI for /api/admin/recover-flutterwave-order — for when a
// Flutterwave payment succeeded but no order was ever created (e.g. the
// buyer's browser gave up before settlement finished, and the webhook
// either wasn't configured yet or its one delivery attempt failed with
// retries off). Paste the tx_ref shown in the Flutterwave dashboard for
// that transaction and click the button — no browser dev tools needed.

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Wrench, CheckCircle, XCircle } from "lucide-react"

export default function RecoverOrderPage() {
  const [reference, setReference] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleRecover = async () => {
    const ref = reference.trim()
    if (!ref) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/recover-flutterwave-order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const orderInfo = data.orderId ? `Order ${data.orderId}` : (data.orderIds ?? []).join(", ")
        setResult({
          ok: true,
          message: data.alreadyExisted
            ? `Order already existed for this reference: ${orderInfo}`
            : `Order created successfully: ${orderInfo}`,
        })
      } else {
        // Surface the real diagnostic (required role vs what we got) instead
        // of a bare "Unauthorized" so it's clear whether this is a role
        // mismatch, a missing session, or something else.
        const detail = data.required
          ? ` (needs role: ${data.required}, session has: ${data.got ?? "none"})`
          : ""
        setResult({ ok: false, message: (data.error || "Something went wrong.") + detail })
      }
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || "Network error." })
    }
    setLoading(false)
  }

  return (
    <div className="container max-w-lg py-8 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" /> Recover Flutterwave Order
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          For a Flutterwave payment that succeeded but never created an order.
          Paste the transaction reference (tx_ref) from your Flutterwave dashboard below.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <label className="text-sm font-medium">Transaction Reference (tx_ref)</label>
          <Input
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="e.g. ZMX-1234567890"
          />
          <Button className="w-full bg-primary text-white" disabled={loading || !reference.trim()} onClick={handleRecover}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Recover Order
          </Button>

          {result && (
            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {result.ok ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
