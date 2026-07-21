// hooks/usePaymentMethods.ts
// Shared logic for every checkout surface (Buy Now, Cart, Boost, Ad Boost,
// Subscription). Reads the admin toggles and produces the buyer-facing
// method list + selection state.
//
// Two independent toggle sets, selected by `context`:
//   "platform"    -> Zamorax Enterprises Direct purchases, subscriptions,
//                    boosts, ad boosts. Governed by the original global
//                    toggles: manualPaymentEnabled / paystackCardEnabled /
//                    paystackBankEnabled / flutterwavePaymentEnabled.
//   "marketplace" -> third-party seller purchases (Buy Now / Cart checkout
//                    when at least one item isn't Zamorax Enterprises
//                    Direct). Governed by its OWN independent toggles:
//                    manualEnabledForMarketplace /
//                    paystackEnabledForMarketplace /
//                    flutterwaveEnabledForMarketplace — these do NOT derive
//                    from or require the global ones. An admin can, for
//                    example, run Manual + Paystack globally with
//                    Flutterwave off everywhere, while still turning
//                    Flutterwave ON just for third-party checkout (and
//                    Paystack off just for third-party checkout) — the two
//                    toggle sets never interact.
//
// Auto-detect behaviour:
//   1 method enabled  -> methods.length === 1, selected auto-set, nothing
//                        for the checkout page to render (no picker).
//   2+ methods enabled -> selected defaults to the first method; the
//                        checkout page renders <PaymentMethodPicker /> and
//                        lets the buyer/seller change it.
"use client"

import { useEffect, useMemo, useState } from "react"
import type { PlatformSettings } from "@/src/services/platformSettings"

// "manual"          -> Bank Transfer (Manual)
// "paystack_card"   -> Pay with Card (Paystack, card-only channel)
// "paystack_bank"   -> Bank (Online) (Paystack, bank/USSD/transfer channels)
// "flutterwave"     -> Pay with Flutterwave (card/bank/USSD — held in escrow)
export type PaymentMethodId = "manual" | "paystack_card" | "paystack_bank" | "flutterwave"

export interface PaymentMethodOption {
  id: PaymentMethodId
  label: string
  desc: string
  // What to pass to PaymentService.initializePayment()
  provider: "manual" | "paystack" | "flutterwave"
  paystackChannel?: "card" | "bank"
}

const ALL_METHODS: Record<PaymentMethodId, PaymentMethodOption> = {
  manual: {
    id: "manual",
    label: "Bank Transfer (Manual)",
    desc: "Transfer manually, then upload proof for admin to confirm.",
    provider: "manual",
  },
  paystack_card: {
    id: "paystack_card",
    label: "Pay with Card",
    desc: "Instant — pay securely with your debit or credit card.",
    provider: "paystack",
    paystackChannel: "card",
  },
  paystack_bank: {
    id: "paystack_bank",
    label: "Bank (Online)",
    desc: "Instant — pay by bank transfer, USSD, or direct bank debit.",
    provider: "paystack",
    paystackChannel: "bank",
  },
  flutterwave: {
    id: "flutterwave",
    label: "Pay with Flutterwave",
    desc: "Instant — card, bank transfer, or USSD. Funds held in escrow until delivery is confirmed.",
    provider: "flutterwave",
  },
}

export type PaymentMethodsContext = "marketplace" | "platform"

export function usePaymentMethods(
  settings: PlatformSettings,
  context: PaymentMethodsContext = "platform"
) {
  const isMarketplace = context === "marketplace"

  // Each toggle below is picked from a fully independent set depending on
  // context — marketplace never falls back to or combines with platform
  // toggles, and vice versa.
  const manualOn      = isMarketplace ? settings.manualEnabledForMarketplace      : settings.manualPaymentEnabled
  const cardOn        = isMarketplace ? settings.paystackEnabledForMarketplace    : settings.paystackCardEnabled
  const bankOn        = isMarketplace ? settings.paystackEnabledForMarketplace    : settings.paystackBankEnabled
  const flutterwaveOn = isMarketplace ? settings.flutterwaveEnabledForMarketplace : settings.flutterwavePaymentEnabled

  const methods = useMemo<PaymentMethodOption[]>(() => {
    const list: PaymentMethodOption[] = []
    if (manualOn) list.push(ALL_METHODS.manual)
    if (cardOn)   list.push(ALL_METHODS.paystack_card)
    if (bankOn)   list.push(ALL_METHODS.paystack_bank)
    if (flutterwaveOn) list.push(ALL_METHODS.flutterwave)
    return list
  }, [manualOn, cardOn, bankOn, flutterwaveOn])

  const [selectedId, setSelectedId] = useState<PaymentMethodId | null>(null)

  // Auto-select: only one enabled -> pick it. Multiple enabled and nothing
  // picked yet -> default to the first in the list (stable, no flicker).
  useEffect(() => {
    if (selectedId && methods.some(m => m.id === selectedId)) return
    if (methods.length > 0) setSelectedId(methods[0].id)
    else setSelectedId(null)
  }, [methods, selectedId])

  const selected = methods.find(m => m.id === selectedId) ?? null
  const showPicker = methods.length >= 2

  return { methods, selected, selectedId, setSelectedId, showPicker }
}
