"use client"
// components/payment/PaymentMethodPicker.tsx
// Shared checkout payment-method picker. Renders nothing if the caller
// passes fewer than 2 methods (usePaymentMethods already filters to just
// the enabled ones) — the parent should only mount this when
// usePaymentMethods().showPicker is true. Auto-detection of "how many
// methods are enabled" lives in usePaymentMethods, not here — this
// component is presentation only, so every checkout surface renders the
// exact same look.

import type { PaymentMethodId, PaymentMethodOption } from "@/hooks/usePaymentMethods"

interface Props {
  methods: PaymentMethodOption[]
  selectedId: PaymentMethodId | null
  onSelect: (id: PaymentMethodId) => void
  name?: string  // radio group name — vary per-surface so multiple pickers on one page don't collide
}

export function PaymentMethodPicker({ methods, selectedId, onSelect, name = "paymentMethod" }: Props) {
  if (methods.length < 2) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">Choose how to pay</p>
      {methods.map(opt => (
        <label
          key={opt.id}
          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
            selectedId === opt.id
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-muted/40"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={selectedId === opt.id}
            onChange={() => onSelect(opt.id)}
            className="mt-0.5 accent-primary"
          />
          <div>
            <p className="text-sm font-medium">{opt.label}</p>
            <p className="text-xs text-muted-foreground">{opt.desc}</p>
          </div>
        </label>
      ))}
    </div>
  )
}
