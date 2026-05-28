"use client"

import { Shield, BadgeCheck, Clock, Truck } from "lucide-react"

const ITEMS = [
  { icon: <BadgeCheck className="h-4 w-4 text-accent shrink-0" />, label: "NIN Verified Sellers" },
  { icon: <Shield className="h-4 w-4 text-primary shrink-0" />,    label: "Escrow Protected" },
  { icon: <Clock className="h-4 w-4 text-amber-500 shrink-0" />,   label: "Free 24hr Inspection" },
  { icon: <Truck className="h-4 w-4 text-blue-500 shrink-0" />,    label: "Nationwide Delivery" },
]

export function TrustBar() {
  return (
    <div className="bg-white border-b border-border/60">
      <div className="container py-2.5 overflow-x-auto">
        <div className="flex items-center justify-between min-w-max md:min-w-0 gap-6 md:gap-0">
          {ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-2 md:flex-1 md:justify-center">
              {item.icon}
              <span className="whitespace-nowrap">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
