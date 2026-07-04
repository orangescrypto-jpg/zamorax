// hooks/usePaymentMethods.ts
// Shared logic for every checkout surface (Buy Now, Cart, Boost, Ad Boost,
// Subscription). Reads the three independent admin toggles
// (manualPaymentEnabled / paystackCardEnabled / paystackBankEnabled) and
// produces the buyer-facing method list + selection state.
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
export type PaymentMethodId = "manual" | "paystack_card" | "paystack_bank"

export interface PaymentMethodOption {
  id: PaymentMethodId
  label: string
  desc: string
  // What to pass to PaymentService.initializePayment()
  provider: "manual" | "paystack"
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
}

export function usePaymentMethods(settings: PlatformSettings) {
  const methods = useMemo<PaymentMethodOption[]>(() => {
    const list: PaymentMethodOption[] = []
    if (settings.manualPaymentEnabled)  list.push(ALL_METHODS.manual)
    if (settings.paystackCardEnabled)   list.push(ALL_METHODS.paystack_card)
    if (settings.paystackBankEnabled)   list.push(ALL_METHODS.paystack_bank)
    return list
  }, [settings.manualPaymentEnabled, settings.paystackCardEnabled, settings.paystackBankEnabled])

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
