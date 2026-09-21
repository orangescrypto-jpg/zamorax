"use client"
// hooks/useLayawayTopUpReturn.ts
// Runs on the buyer's order detail page. When the buyer returns from
// Paystack or Flutterwave after a layaway top-up, the URL carries
//   ?layawayTopUp=<planId>
// plus the gateway's own params:
//   Paystack     -> ?reference=... or ?trxref=...
//   Flutterwave  -> ?tx_ref=...&transaction_id=...&status=...
// This hook verifies the payment and credits the plan through
// /api/orders/layaway-topup-confirm (which forwards to layaway-pay).
// layaway-pay is idempotent on provider_ref, so a page reload or a retry
// can never credit the same payment twice.
//
// Gateways can report success to the browser a few seconds before their
// own verify API does, so a 402 "Payment not verified" is retried with
// backoff instead of failing on the first attempt.
import { useEffect, useRef } from "react"
import { useToast } from "@/components/ui/use-toast"

const RETRY_DELAYS_MS = [0, 3000, 6000, 10000, 15000]

type Provider = "paystack" | "flutterwave"

export function useLayawayTopUpReturn(opts: {
  ready: boolean
  onCredited: () => void
}) {
  const { toast } = useToast()
  const processed = useRef<Set<string>>(new Set())
  const onCreditedRef = useRef(opts.onCredited)
  onCreditedRef.current = opts.onCredited

  useEffect(() => {
    if (!opts.ready) return

    let planId: string | null = null
    let reference: string | null = null
    let provider: Provider | null = null
    let flwFailed = false

    try {
      const params = new URLSearchParams(window.location.search)
      planId = params.get("layawayTopUp")
      if (!planId) return

      const flwRef = params.get("tx_ref")
      const psRef = params.get("reference") || params.get("trxref")
      reference = psRef || flwRef
      if (flwRef && !psRef) provider = "flutterwave"
      else if (psRef) provider = "paystack"
      flwFailed = params.get("status") === "cancelled"

      // sessionStorage knows the provider for certain, and lets us recover
      // the reference if the gateway redirect somehow dropped it.
      if (reference) {
        const stored = sessionStorage.getItem(`pending_layaway_topup_${reference}`)
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            if (parsed?.provider === "paystack" || parsed?.provider === "flutterwave") provider = parsed.provider
            if (parsed?.planId) planId = parsed.planId
          } catch { /* ignore malformed */ }
        }
      } else {
        const keys = Object.keys(sessionStorage).filter(k => k.startsWith("pending_layaway_topup_"))
        for (const key of keys.reverse()) {
          try {
            const parsed = JSON.parse(sessionStorage.getItem(key) || "")
            if (parsed?.planId === planId) {
              reference = key.replace("pending_layaway_topup_", "")
              provider = parsed.provider
              break
            }
          } catch { /* ignore malformed */ }
        }
      }
    } catch {
      return
    }

    if (!planId || !reference) return

    const cleanUrl = () => {
      try {
        window.history.replaceState({}, "", window.location.pathname)
      } catch { /* non-fatal */ }
    }

    if (flwFailed) {
      cleanUrl()
      toast({ title: "Payment cancelled", description: "No money was taken. You can try again.", variant: "destructive" })
      return
    }

    if (processed.current.has(reference)) return
    processed.current.add(reference)

    const finalPlanId = planId
    const finalRef = reference
    // If provider is unknown, try both. Each gateway's verify returns
    // "not verified" for a reference that isn't theirs, so it is safe.
    const providersToTry: Provider[] = provider ? [provider] : ["paystack", "flutterwave"]

    const attempt = async (): Promise<{ ok: true; completed?: boolean } | { ok: false; hardFail: boolean; error?: string }> => {
      let lastStatus = 0
      let lastError: string | undefined
      for (const p of providersToTry) {
        const res = await fetch("/api/orders/layaway-topup-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: finalPlanId, reference: finalRef, provider: p }),
        })
        const json = await res.json().catch(() => ({}))
        if (res.ok) return { ok: true, completed: json.completed }
        lastStatus = res.status
        lastError = json.error
      }
      // 402 = not verified yet, worth retrying. Anything else won't fix itself.
      return { ok: false, hardFail: lastStatus !== 402, error: lastError }
    }

    ;(async () => {
      for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
        if (RETRY_DELAYS_MS[i] > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[i]))
        try {
          const result = await attempt()
          if (result.ok) {
            try { sessionStorage.removeItem(`pending_layaway_topup_${finalRef}`) } catch { /* ignore */ }
            cleanUrl()
            toast({
              title: result.completed ? "Layaway fully paid" : "Payment received",
              description: result.completed
                ? "Your plan is complete. Your order will now be processed for delivery."
                : "Your payment has been added to your layaway plan.",
              variant: "success",
            })
            onCreditedRef.current()
            return
          }
          if (result.hardFail) {
            processed.current.delete(finalRef)
            cleanUrl()
            toast({
              title: "Couldn't credit your payment",
              description: result.error || "If you were charged, contact support with your payment reference.",
              variant: "destructive",
            })
            return
          }
        } catch (err) {
          console.error("layaway top-up confirm network error (will retry):", finalRef, err)
        }
      }
      // Retries exhausted. Keep the sessionStorage key and URL so a manual
      // refresh can try again.
      processed.current.delete(finalRef)
      toast({
        title: "Still confirming your payment",
        description: "This can take a minute. Refresh this page shortly, your payment will be added automatically.",
        variant: "destructive",
      })
    })()
  }, [opts.ready])
}

export default useLayawayTopUpReturn
