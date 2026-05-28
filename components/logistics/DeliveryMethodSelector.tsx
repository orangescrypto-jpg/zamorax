"use client"

import {AdminService, orderBy, where, query} from "@/src/services"
// components/logistics/DeliveryMethodSelector.tsx
// Shown during checkout — buyer picks their delivery method

import { useEffect, useState } from "react"
import { calculateDeliveryFee, type DeliveryMethod, type AgentLocation } from "@/src/types"
import { formatPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  Users, Package, Zap, MapPin, ChevronDown,
  Clock, Shield, Truck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Props {
  sellerState: string
  buyerState: string
  isFBZ: boolean
  value: DeliveryMethod
  onChange: (method: DeliveryMethod, meta: DeliveryMethodMeta) => void
}

export interface DeliveryMethodMeta {
  deliveryFee: number
  destinationAgentId?: string
  destinationAgentName?: string
  destinationAgentAddress?: string
  deliveryType?: "agent_pickup" | "doorstep"
  estimatedDays?: number
}

export function DeliveryMethodSelector({ sellerState, buyerState, isFBZ, value, onChange }: Props) {
  const [agents, setAgents] = useState<AgentLocation[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [deliveryType, setDeliveryType] = useState<"agent_pickup" | "doorstep">("agent_pickup")
  const [loadingAgents, setLoadingAgents] = useState(false)

  const deliveryFee = calculateDeliveryFee(sellerState, buyerState)
  const isSameState = sellerState === buyerState
  const estDays     = isSameState ? 2 : sellerState && buyerState ? 5 : 3

  // Load agents in buyer's state
  useEffect(() => {
    if (!buyerState) return
    setLoadingAgents(true)
    AdminService._ref_("agentLocations", [where("state", "==", buyerState),
      where("isActive", "==", true),
      orderBy("name"]))
      .then(docs => setAgents(docs.map(d => ({ id: d.id, ...d.data() })))
      .catch(() => {})
      .finally(() => setLoadingAgents(false))
  }, [buyerState])

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  const handleSelectLogistics = (agentId: string, dType: "agent_pickup" | "doorstep") => {
    const agent = agents.find(a => a.id === agentId)
    onChange("zamorax_logistics", {
      deliveryFee,
      destinationAgentId:      agentId,
      destinationAgentName:    agent?.name,
      destinationAgentAddress: agent?.address,
      deliveryType:            dType,
      estimatedDays:           estDays,
    })
  }

  const OPTIONS = [
    {
      id: "meetup" as DeliveryMethod,
      title: "Safe Meetup",
      subtitle: "Meet the seller at a safe public spot",
      icon: <Users className="h-5 w-5" />,
      fee: 0,
      badge: null,
      color: "border-emerald-200 bg-emerald-50",
      activeColor: "border-emerald-500 bg-emerald-50",
    },
    {
      id: "zamorax_logistics" as DeliveryMethod,
      title: "Zamorax Logistics",
      subtitle: `Seller drops at agent → delivered to you · Est. ${estDays} days`,
      icon: <Package className="h-5 w-5" />,
      fee: deliveryFee,
      badge: "No meetup needed",
      color: "border-primary/20 bg-primary/5",
      activeColor: "border-primary bg-primary/5",
    },
    ...(isFBZ ? [{
      id: "fbz" as DeliveryMethod,
      title: "FBZ Express",
      subtitle: "Shipped directly from Zamorax warehouse",
      icon: <Zap className="h-5 w-5 fill-white" />,
      fee: deliveryFee,
      badge: "⚡ Fastest",
      color: "border-amber-200 bg-amber-50",
      activeColor: "border-amber-500 bg-amber-50",
    }] : []),
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Choose Delivery Method</p>

      {OPTIONS.map(opt => {
        const isActive = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              if (opt.id === "meetup") onChange("meetup", { deliveryFee: 0 })
              else if (opt.id === "fbz")  onChange("fbz", { deliveryFee: opt.fee, estimatedDays: 2 })
              else { /* user still needs to pick agent */ onChange("zamorax_logistics", { deliveryFee: opt.fee, estimatedDays: estDays }) }
            }}
            className={cn(
              "w-full text-left p-4 rounded-xl border-2 transition-all",
              isActive ? opt.activeColor : `${opt.color} hover:border-muted-foreground/40`
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                isActive ? "bg-primary text-white" : "bg-white border border-border text-muted-foreground"
              )}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{opt.title}</p>
                  {opt.badge && (
                    <Badge className="bg-primary/10 text-primary text-[10px] px-1.5">{opt.badge}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.subtitle}</p>
              </div>
              <div className="text-right shrink-0">
                {opt.fee === 0
                  ? <p className="text-sm font-bold text-emerald-600">Free</p>
                  : <p className="text-sm font-bold text-primary">{formatPrice(opt.fee)}</p>
                }
              </div>
            </div>
          </button>
        )
      })}

      {/* Agent picker — shown when zamorax_logistics is selected */}
      {value === "zamorax_logistics" && (
        <div className="mt-2 space-y-3 pl-2 border-l-2 border-primary/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Select your nearest pickup agent in {buyerState}
          </p>

          {loadingAgents ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading agents...</p>
          ) : agents.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              No agents available in {buyerState} yet. Choose a different delivery method or contact support.
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    setSelectedAgentId(agent.id)
                    handleSelectLogistics(agent.id, deliveryType)
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all text-sm",
                    selectedAgentId === agent.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.address}</p>
                      <p className="text-xs text-muted-foreground">{agent.operatingHours}</p>
                    </div>
                    {selectedAgentId === agent.id && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Doorstep option */}
          {selectedAgentId && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Last-mile delivery</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: "agent_pickup", label: "I'll pick up", sub: "From agent location", icon: <MapPin className="h-3.5 w-3.5" /> },
                  { v: "doorstep",     label: "Doorstep",     sub: "+₦500 extra",         icon: <Truck className="h-3.5 w-3.5" /> },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => {
                      setDeliveryType(opt.v)
                      handleSelectLogistics(selectedAgentId, opt.v)
                    }}
                    className={cn(
                      "p-2.5 rounded-lg border text-left text-xs transition-all",
                      deliveryType === opt.v ? "border-primary bg-primary/5 font-semibold" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {opt.icon}<span>{opt.label}</span>
                    </div>
                    <p className="text-muted-foreground">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { icon: <Shield className="h-3 w-3" />, text: "Escrow protected" },
              { icon: <Clock className="h-3 w-3" />,  text: `Est. ${estDays} days` },
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
  )
}
