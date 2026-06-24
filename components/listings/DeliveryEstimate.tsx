"use client"

import { useMemo } from "react"
import { Truck, Clock, MapPin, Package } from "lucide-react"

interface DeliveryEstimateProps {
  deliveryNationwide: boolean
  nigerianState: string
  city: string
  listingStatus: string
}

// Lagos delivery partners and rough estimates
// Replace with real GIGL/Kwik/Sendbox API calls when keys are active
const STATE_DELIVERY_DAYS: Record<string, { min: number; max: number; partner: string }> = {
  "Lagos":       { min: 1, max: 2,  partner: "Kwik Express" },
  "Abuja":       { min: 2, max: 3,  partner: "GIG Logistics" },
  "Rivers":      { min: 2, max: 3,  partner: "GIG Logistics" },
  "Ogun":        { min: 1, max: 2,  partner: "Kwik Express" },
  "Oyo":         { min: 2, max: 3,  partner: "GIG Logistics" },
  "Kano":        { min: 3, max: 5,  partner: "GIG Logistics" },
  "Kaduna":      { min: 3, max: 5,  partner: "GIG Logistics" },
  "Enugu":       { min: 2, max: 4,  partner: "Sendbox" },
  "Anambra":     { min: 2, max: 4,  partner: "Sendbox" },
  "Delta":       { min: 2, max: 4,  partner: "Sendbox" },
  "Edo":         { min: 2, max: 4,  partner: "Sendbox" },
}

function getDeliveryEstimate(fromState: string) {
  const known = STATE_DELIVERY_DAYS[fromState]
  if (known) return known
  return { min: 3, max: 7, partner: "GIG Logistics" }
}

function getBusinessDaysFromNow(minDays: number, maxDays: number): { earliest: string; latest: string } {
  const addBusinessDays = (date: Date, days: number) => {
    let count = 0
    const d = new Date(date)
    while (count < days) {
      d.setDate(d.getDate() + 1)
      const day = d.getDay()
      if (day !== 0 && day !== 6) count++ // skip weekends
    }
    return d
  }

  const now = new Date()
  const earliest = addBusinessDays(now, minDays)
  const latest = addBusinessDays(now, maxDays)

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" })

  return { earliest: fmt(earliest), latest: fmt(latest) }
}

// Rough delivery cost estimate (replace with real API)
function estimateDeliveryCost(fromState: string): { min: number; max: number } {
  const intraState = ["Lagos", "Ogun"]
  if (intraState.includes(fromState)) return { min: 1500, max: 3000 }
  return { min: 2500, max: 5000 }
}

export function DeliveryEstimate({
  deliveryNationwide,
  nigerianState,
  city,
  listingStatus,
}: DeliveryEstimateProps) {
  const estimate = useMemo(() => getDeliveryEstimate(nigerianState), [nigerianState])
  const { earliest, latest } = useMemo(
    () => getBusinessDaysFromNow(estimate.min, estimate.max),
    [estimate]
  )
  const cost = useMemo(() => estimateDeliveryCost(nigerianState), [nigerianState])

  if (!deliveryNationwide || listingStatus !== "active") return null

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
          <Truck className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">Delivery Available</p>
          <p className="text-xs text-emerald-600">Nationwide delivery via {estimate.partner}</p>
        </div>
      </div>

      {/* Estimate rows */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock className="h-3.5 w-3.5" />
            <span>Estimated arrival</span>
          </div>
          <span className="text-xs font-semibold text-secondary">
            {earliest === latest ? earliest : `${earliest} – ${latest}`}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <MapPin className="h-3.5 w-3.5" />
            <span>Ships from</span>
          </div>
          <span className="text-xs font-medium text-secondary">
            {city ? `${city}, ` : ""}{nigerianState}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Package className="h-3.5 w-3.5" />
            <span>Delivery fee (est.)</span>
          </div>
          <span className="text-xs font-medium text-secondary">
            ₦{cost.min.toLocaleString()} – ₦{cost.max.toLocaleString()}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/70 italic">
        * Actual delivery time and cost confirmed at checkout. Delivered {estimate.min}–{estimate.max} business days after payment.
      </p>
    </div>
  )
}
