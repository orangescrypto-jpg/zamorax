"use client"
// components/shared/SellerTrustScore.tsx
// trustScoreVisible + trustScoreNinWeight + trustScoreBvnWeight from config/platform.
// Weights are now dynamic — admin controls them without a code push.

import { Shield, Star, CheckCircle, TrendingUp, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

interface SellerTrustScoreProps {
  ninVerified: boolean
  bvnVerified: boolean
  sellerRating: number        // 0–5
  totalSales: number
  totalRentals: number
  completionRate?: number     // 0–100
  disputeRate?: number        // 0–100
  responseRate?: number       // 0–100
  size?: "sm" | "md" | "lg"
  showBreakdown?: boolean
}

function calcTrustScore(
  props: SellerTrustScoreProps,
  ninWeight: number,
  bvnWeight: number,
): number {
  // The remaining 100 - ninWeight - bvnWeight points are split:
  //   rating (25), orders (15), completion (15), dispute (5), response (5) = 65 base
  //   We scale proportionally to whatever is left.
  const identityPts = (props.ninVerified ? ninWeight : 0) + (props.bvnVerified ? bvnWeight : 0)
  const remaining = 100 - ninWeight - bvnWeight

  // Sub-scores out of their fixed proportions, then scaled to `remaining`
  const ratingPts      = Math.min((props.sellerRating / 5) * (remaining * 0.38), remaining * 0.38)
  const orders         = props.totalSales + props.totalRentals
  const orderPts       = Math.min(orders * 0.5, remaining * 0.23)
  const completionPts  = props.completionRate !== undefined ? (props.completionRate / 100) * (remaining * 0.23) : remaining * 0.15
  const disputePts     = props.disputeRate   !== undefined ? ((100 - props.disputeRate) / 100) * (remaining * 0.08) : remaining * 0.08
  const responsePts    = props.responseRate  !== undefined ? (props.responseRate / 100) * (remaining * 0.08) : remaining * 0.05

  return Math.min(Math.round(identityPts + ratingPts + orderPts + completionPts + disputePts + responsePts), 100)
}

function getTier(score: number) {
  if (score >= 85) return { label: "Platinum", color: "text-cyan-600",   ring: "ring-cyan-400",   bg: "bg-cyan-50"   }
  if (score >= 70) return { label: "Gold",     color: "text-amber-500",  ring: "ring-amber-400",  bg: "bg-amber-50"  }
  if (score >= 50) return { label: "Silver",   color: "text-slate-500",  ring: "ring-slate-400",  bg: "bg-slate-50"  }
  return                   { label: "New",     color: "text-gray-400",   ring: "ring-gray-300",   bg: "bg-gray-50"   }
}

export function SellerTrustScore(props: SellerTrustScoreProps) {
  const { settings } = usePlatformSettings()
  const { size = "md", showBreakdown = false } = props

  // ── Gate: admin hid trust score ───────────────────────────────────────────
  if (!settings.trustScoreVisible) return null

  const ninWeight = settings.trustScoreNinWeight
  const bvnWeight = settings.trustScoreBvnWeight
  const score = calcTrustScore(props, ninWeight, bvnWeight)
  const tier = getTier(score)
  const orders = props.totalSales + props.totalRentals

  if (size === "sm") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold", tier.bg, tier.color)}>
        <Shield className="h-3 w-3" />
        <span>{score}</span>
        <span className="font-normal opacity-70">· {tier.label}</span>
      </div>
    )
  }

  if (size === "md") {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border", tier.bg)}>
        <div className={cn("flex items-center justify-center w-8 h-8 rounded-full ring-2 font-bold text-sm", tier.ring, tier.color, tier.bg)}>
          {score}
        </div>
        <div>
          <p className={cn("text-xs font-semibold", tier.color)}>{tier.label} Seller</p>
          <p className="text-xs text-muted-foreground">
            {props.ninVerified && "NIN ✓ "}
            {props.bvnVerified && "BVN ✓ "}
            {orders > 0 && `${orders} orders`}
          </p>
        </div>
      </div>
    )
  }

  // size === "lg"
  const breakdown = [
    { label: "NIN Verified",    value: props.ninVerified ? ninWeight : 0,  max: ninWeight, icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { label: "BVN Verified",    value: props.bvnVerified ? bvnWeight : 0,  max: bvnWeight, icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { label: "Star Rating",     value: Math.round((props.sellerRating / 5) * 25), max: 25, icon: <Star className="h-3.5 w-3.5" /> },
    { label: "Order History",   value: Math.min(orders, 15),               max: 15,        icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { label: "Response & More", value: Math.max(0, score - (props.ninVerified ? ninWeight : 0) - (props.bvnVerified ? bvnWeight : 0) - Math.round((props.sellerRating / 5) * 25) - Math.min(orders, 15)), max: 100 - ninWeight - bvnWeight - 25 - 15, icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className={cn("rounded-xl border p-4 space-y-4", tier.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center justify-center w-14 h-14 rounded-full ring-4 font-bold text-xl", tier.ring, tier.color, "bg-white")}>
            {score}
          </div>
          <div>
            <p className={cn("font-bold text-base", tier.color)}>{tier.label} Seller</p>
            <p className="text-xs text-muted-foreground">Trust Score out of 100</p>
          </div>
        </div>
        <Shield className={cn("h-8 w-8", tier.color)} />
      </div>

      {showBreakdown && (
        <div className="space-y-2">
          {breakdown.map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">{item.icon}{item.label}</span>
                <span className="font-medium">{item.value}/{item.max}</span>
              </div>
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", tier.color.replace("text-", "bg-"))}
                  style={{ width: item.max > 0 ? `${Math.min((item.value / item.max) * 100, 100)}%` : "0%" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
