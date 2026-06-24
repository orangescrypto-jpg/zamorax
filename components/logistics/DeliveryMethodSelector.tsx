"use client"

// components/logistics/DeliveryMethodSelector.tsx
// ─────────────────────────────────────────────────────────────────
// Shown inside EscrowConfirmModal at checkout.
//
// COVERAGE RULES:
//   • ZLA option is only FULLY enabled when BOTH seller state AND buyer
//     state have an active agent.
//   • If seller has an agent but buyer's state has none → show ZLA card
//     as disabled with message "No ZamoraxLogic agent in your state yet".
//   • If buyer's state has an agent but seller's state has none → show
//     disabled card "No agent in seller's state yet".
//   • If neither → disabled "Not yet available for this route".
//   • When enabled, buyer sees agents available in THEIR state only
//     (for pickup sub-option). The seller's origin agent is assigned by
//     ZamoraxLogic at booking time — we don't show it here.
//
// All coverage data comes from agentLocations (via ShippingService) which
// is the single source of truth — same collection admin writes to.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { LogisticsService, type DeliveryFeeBreakdown } from "@/src/services"
import { ShippingService, type ZLAStateCoverage } from "@/src/services/shipping"
import { AdminService, where } from "@/src/services"
import { formatPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  Users, Package, Zap, Clock, Shield, Truck,
  Loader2, AlertTriangle, MapPin, Info,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export type DeliveryMethod = "meetup" | "zamorax_logistics" | "fbz"

export interface DeliveryMethodMeta {
  deliveryFee:    number
  deliveryType?:  "agent_pickup" | "doorstep"
  estimatedDays?: number
  weightKg?:      number
  isFragile?:     boolean
  breakdown?:     DeliveryFeeBreakdown
}

interface AgentSummary {
  id:             string
  name:           string
  address:        string
  state:          string
  city:           string
  phone:          string
  operatingHours: string
}

interface Props {
  sellerState:  string
  buyerState:   string    // updated live as buyer selects their state in checkout form
  weightKg?:    number
  isFragile?:   boolean
  isFBZ:        boolean
  value:        DeliveryMethod
  onChange:     (method: DeliveryMethod, meta: DeliveryMethodMeta) => void
}

export function DeliveryMethodSelector({
  sellerState, buyerState, weightKg = 0.5, isFragile = false,
  isFBZ, value, onChange,
}: Props) {
  const [agentBreakdown,    setAgentBreakdown]    = useState<DeliveryFeeBreakdown | null>(null)
  const [doorstepBreakdown, setDoorstepBreakdown] = useState<DeliveryFeeBreakdown | null>(null)
  const [loadingFee,        setLoadingFee]        = useState(false)

  // Coverage
  const [coverage,        setCoverage]        = useState<ZLAStateCoverage | null>(null)
  const [loadingCoverage, setLoadingCoverage] = useState(false)

  // Agents in buyer's state (shown when ZLA is selected + buyer covered)
  const [buyerAgents,     setBuyerAgents]     = useState<AgentSummary[]>([])
  const [loadingAgents,   setLoadingAgents]   = useState(false)

  const [deliveryType, setDeliveryType] = useState<"agent_pickup" | "doorstep">("agent_pickup")

  const isSameState   = sellerState === buyerState
  const estimatedDays = isSameState ? 2 : 5

  // ── 1. Coverage check — runs when either state changes ──────────────────
  useEffect(() => {
    if (!sellerState) return
    setLoadingCoverage(true)
    setCoverage(null)

    ShippingService.getCoverageForStates(sellerState, buyerState || "")
      .then(setCoverage)
      .catch(() => setCoverage({ sellerCovered: false, buyerCovered: false, bothCovered: false }))
      .finally(() => setLoadingCoverage(false))
  }, [sellerState, buyerState])

  // ── 2. Fee calculation — only when both states are covered ─────────────
  useEffect(() => {
    if (!sellerState || !buyerState || !coverage?.bothCovered) return
    setLoadingFee(true)

    Promise.all([
      LogisticsService.getDeliveryFee(sellerState, buyerState, { weightKg, isFragile, isDoorstep: false }),
      LogisticsService.getDeliveryFee(sellerState, buyerState, { weightKg, isFragile, isDoorstep: true }),
    ])
      .then(([agent, doorstep]) => {
        setAgentBreakdown(agent)
        setDoorstepBreakdown(doorstep)
        // Keep meta up to date if ZLA is already selected
        if (value === "zamorax_logistics") {
          const bd = deliveryType === "doorstep" ? doorstep : agent
          onChange("zamorax_logistics", {
            deliveryFee: bd.total, deliveryType, estimatedDays,
            weightKg, isFragile, breakdown: bd,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFee(false))
  }, [sellerState, buyerState, weightKg, isFragile, coverage?.bothCovered])

  // ── 3. Buyer-state agents — loaded when ZLA selected + buyer covered ───
  useEffect(() => {
    if (value !== "zamorax_logistics" || !coverage?.buyerCovered || !buyerState) return
    setLoadingAgents(true)

    AdminService.getCollection("agentLocations", [
      where("state",    "==", buyerState),
      where("isActive", "==", true),
    ])
      .then((docs: any[]) => {
        setBuyerAgents(docs.map((d: any) => ({
          id:             d.id,
          name:           d.name,
          address:        d.address,
          state:          d.state,
          city:           d.city           || "",
          phone:          d.agentPhone     || "",
          operatingHours: d.operatingHours || "",
        })))
      })
      .catch(() => setBuyerAgents([]))
      .finally(() => setLoadingAgents(false))
  }, [value, buyerState, coverage?.buyerCovered])

  const handleZLASelect = (dType: "agent_pickup" | "doorstep") => {
    const bd = dType === "doorstep" ? doorstepBreakdown : agentBreakdown
    if (!bd) return
    setDeliveryType(dType)
    onChange("zamorax_logistics", {
      deliveryFee: bd.total, deliveryType: dType, estimatedDays,
      weightKg, isFragile, breakdown: bd,
    })
  }

  const zlaFee = (deliveryType === "doorstep" ? doorstepBreakdown : agentBreakdown)?.total ?? 0

  // ── ZLA disabled message ────────────────────────────────────────────────
  const zlaDisabledReason: string | null = (() => {
    if (loadingCoverage || !coverage) return null
    if (coverage.bothCovered)  return null   // fully available
    if (!sellerState)          return "Enter seller location to check availability"
    if (!buyerState)           return null   // buyer hasn't picked state yet — don't warn early
    if (!coverage.sellerCovered && !coverage.buyerCovered)
      return "ZamoraxLogic is not yet available in your area or the seller's area"
    if (!coverage.sellerCovered)
      return "No ZamoraxLogic agent in the seller's state yet"
    if (!coverage.buyerCovered)
      return "No ZamoraxLogic agent available in your state yet"
    return null
  })()

  const zlaEnabled = coverage?.bothCovered ?? false
  const zlaDisabled = !zlaEnabled

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Choose Delivery Method</p>

      {/* ── Meetup ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => onChange("meetup", { deliveryFee: 0 })}
        className={cn(
          "w-full text-left p-4 rounded-xl border-2 transition-all",
          value === "meetup"
            ? "border-emerald-500 bg-emerald-50"
            : "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg shrink-0",
            value === "meetup" ? "bg-emerald-500 text-white" : "bg-white border text-muted-foreground"
          )}>
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Safe Meetup</p>
            <p className="text-xs text-muted-foreground">Meet seller at a safe public spot</p>
          </div>
          <p className="text-sm font-bold text-emerald-600 shrink-0">Free</p>
        </div>
      </button>

      {/* ── ZamoraxLogic Delivery ───────────────────────────────────────── */}
      <div className="space-y-0">
        <button
          type="button"
          disabled={zlaDisabled}
          onClick={() => {
            if (zlaDisabled) return
            setDeliveryType("agent_pickup")
            handleZLASelect("agent_pickup")
          }}
          className={cn(
            "w-full text-left p-4 rounded-xl border-2 transition-all",
            zlaDisabled
              ? "border-muted bg-muted/30 opacity-70 cursor-not-allowed"
              : value === "zamorax_logistics"
              ? "border-primary bg-primary/5"
              : "border-primary/20 bg-primary/5 hover:border-primary/40"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg shrink-0",
              zlaDisabled
                ? "bg-muted border text-muted-foreground"
                : value === "zamorax_logistics"
                ? "bg-primary text-white"
                : "bg-white border text-muted-foreground"
            )}>
              <Package className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">ZamoraxLogic Delivery</p>
                {!zlaDisabled && (
                  <Badge className="bg-primary/10 text-primary text-[10px] px-1.5">
                    No meetup needed
                  </Badge>
                )}
                {loadingCoverage && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Coverage status message */}
              {zlaDisabledReason && buyerState ? (
                <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {zlaDisabledReason}
                </p>
              ) : !buyerState && !loadingCoverage ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select your state above to check availability
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Seller drops parcel at nearest agent · Est. {estimatedDays} days
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              {zlaDisabled ? (
                <p className="text-xs text-muted-foreground">Unavailable</p>
              ) : loadingFee ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-sm font-bold text-primary">{formatPrice(zlaFee)}</p>
              )}
            </div>
          </div>
        </button>

        {/* ── Expanded ZLA sub-options (only when selected + enabled) ──── */}
        {value === "zamorax_logistics" && !zlaDisabled && agentBreakdown && (
          <div className="mt-1 space-y-3 pl-2 border-l-2 border-primary/30">

            {/* Last-mile type */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">
              Last-mile delivery
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                {
                  v:   "agent_pickup" as const,
                  label: "I'll pick up",
                  sub:   "From agent near you",
                  icon:  <Package className="h-3.5 w-3.5" />,
                },
                {
                  v:   "doorstep" as const,
                  label: "Doorstep",
                  sub:   doorstepBreakdown
                    ? `+${formatPrice(doorstepBreakdown.doorstepFee)}`
                    : "Loading…",
                  icon:  <Truck className="h-3.5 w-3.5" />,
                },
              ]).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => handleZLASelect(opt.v)}
                  className={cn(
                    "p-2.5 rounded-lg border text-left text-xs transition-all",
                    deliveryType === opt.v
                      ? "border-primary bg-primary/5 font-semibold"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {opt.icon}<span>{opt.label}</span>
                  </div>
                  <p className="text-muted-foreground">{opt.sub}</p>
                </button>
              ))}
            </div>

            {/* Fee breakdown */}
            {(() => {
              const bd = deliveryType === "doorstep" ? doorstepBreakdown : agentBreakdown
              if (!bd) return null
              return (
                <div className="rounded-lg bg-muted/30 border px-3 py-2.5 space-y-1.5 text-xs">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
                    Fee breakdown
                  </p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base rate ({bd.routeLabel})</span>
                    <span className="font-medium">{formatPrice(bd.base)}</span>
                  </div>
                  {bd.weightSurcharge > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Weight surcharge ({weightKg}kg above 2kg)</span>
                      <span>+{formatPrice(bd.weightSurcharge)}</span>
                    </div>
                  )}
                  {bd.doorstepFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Doorstep fee</span>
                      <span>+{formatPrice(bd.doorstepFee)}</span>
                    </div>
                  )}
                  {bd.fragileFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fragile handling</span>
                      <span>+{formatPrice(bd.fragileFee)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total delivery fee</span>
                    <span className="text-primary">{formatPrice(bd.total)}</span>
                  </div>
                </div>
              )
            })()}

            {/* Agents in buyer's state — shown for agent_pickup */}
            {deliveryType === "agent_pickup" && coverage?.buyerCovered && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Pickup agents in {buyerState}
                </p>
                {loadingAgents ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading agents…
                  </div>
                ) : buyerAgents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No agents found in your area.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {buyerAgents.map(agent => (
                      <div
                        key={agent.id}
                        className="rounded-lg border bg-background px-3 py-2 text-xs space-y-0.5"
                      >
                        <p className="font-semibold">{agent.name}</p>
                        <p className="text-muted-foreground">{agent.address}</p>
                        <p className="text-muted-foreground">
                          {agent.phone}
                          {agent.operatingHours ? ` · ${agent.operatingHours}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Bring your tracking code or phone number to collect.
                </p>
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: <Shield  className="h-3 w-3" />, text: "Escrow protected" },
                { icon: <Clock   className="h-3 w-3" />, text: `Est. ${estimatedDays} days` },
                { icon: <Package className="h-3 w-3" />, text: "Tracked" },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {b.icon}{b.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FBZ ────────────────────────────────────────────────────────── */}
      {isFBZ && (
        <button
          type="button"
          onClick={() => onChange("fbz", {
            deliveryFee: agentBreakdown?.total ?? 0, estimatedDays: 2, weightKg, isFragile,
          })}
          className={cn(
            "w-full text-left p-4 rounded-xl border-2 transition-all",
            value === "fbz"
              ? "border-amber-500 bg-amber-50"
              : "border-amber-200 bg-amber-50 hover:border-amber-300"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg shrink-0",
              value === "fbz" ? "bg-amber-500 text-white" : "bg-white border text-muted-foreground"
            )}>
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">FBZ Express</p>
                <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5">⚡ Fastest</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Shipped from Zamorax warehouse</p>
            </div>
          </div>
        </button>
      )}
    </div>
  )
}
