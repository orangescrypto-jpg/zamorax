"use client"

import { Shield, Star, CheckCircle, TrendingUp, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface SellerTrustScoreProps {
  ninVerified: boolean
  bvnVerified: boolean
  sellerRating: number        // 0–5
  totalSales: number
  totalRentals: number
  completionRate?: number     // 0–100, optional (pass if available)
  disputeRate?: number        // 0–100, optional
  responseRate?: number       // 0–100, optional
  size?: "sm" | "md" | "lg"
  showBreakdown?: boolean
}

function calcTrustScore({
  ninVerified, bvnVerified, sellerRating,
  totalSales, totalRentals, completionRate, disputeRate, responseRate,
}: SellerTrustScoreProps): number {
  let score = 0
  if (ninVerified)  score += 20
  if (bvnVerified)  score += 15
  score += Math.min((sellerRating / 5) * 25, 25)
  const orders = totalSales + totalRentals
  score += Math.min(orders * 0.5, 15)
  if (completionRate !== undefined) score += (completionRate / 100) * 15
  else score += 10
  if (disputeRate !== undefined) score += ((100 - disputeRate) / 100) * 5
  else score += 5
  if (responseRate !== undefined) score += (responseRate / 100) * 5
  else score += 3
  return Math.min(Math.round(score), 100)
}

function getTier(score: number): { label: string; color: string; ring: string; bg: string } {
  if (score >= 85) return { label: "Platinum",  color: "text-cyan-600",   ring: "ring-cyan-400",   bg: "bg-cyan-50"   }
  if (score >= 70) return { label: "Gold",       color: "text-amber-500",  ring: "ring-amber-400",  bg: "bg-amber-50"  }
  if (score >= 50) return { label: "Silver",     color: "text-slate-500",  ring: "ring-slate-400",  bg: "bg-slate-50"  }
  return                   { label: "New",        color: "text-gray-400",   ring: "ring-gray-300",   bg: "bg-gray-50"   }
}

export function SellerTrustScore(props: SellerTrustScoreProps) {
  const { size = "md", showBreakdown = false } = props
  const score = calcTrustScore(props)
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

  // size === "lg" — full breakdown for profile page
  const breakdown = [
    { label: "NIN Verified",     value: props.ninVerified ? 20 : 0,  max: 20, icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { label: "BVN Verified",     value: props.bvnVerified ? 15 : 0,  max: 15, icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { label: "Star Rating",      value: Math.round((props.sellerRating / 5) * 25), max: 25, icon: <Star className="h-3.5 w-3.5" /> },
    { label: "Order History",    value: Math.min(orders, 30),         max: 30, icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { label: "Response & More",  value: Math.round(score - Math.min((props.sellerRating/5)*25,25) - (props.ninVerified?20:0) - (props.bvnVerified?15:0) - Math.min(orders,30)), max: 10, icon: <MessageSquare className="h-3.5 w-3.5" /> },
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
                  style={{ width: `${(item.value / item.max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
