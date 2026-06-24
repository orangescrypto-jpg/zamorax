"use client"
// components/buyer/BuyerBadges.tsx

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ShieldCheck, Star, Zap } from "lucide-react"

const BADGE_CONFIG: Record<string, {
  label: string
  description: string
  icon: React.ReactNode
  className: string
}> = {
  verified_buyer: {
    label: "Verified Buyer",
    description: "Completed 5+ orders on Zamorax",
    icon: <ShieldCheck className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  trusted_buyer: {
    label: "Trusted Buyer",
    description: "Completed 20+ orders on Zamorax",
    icon: <Star className="h-3 w-3" />,
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  power_buyer: {
    label: "Power Buyer",
    description: "Completed 50+ orders on Zamorax",
    icon: <Zap className="h-3 w-3" />,
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
}

interface Props {
  badges: string[]
  size?: "sm" | "default"
}

export function BuyerBadges({ badges, size = "default" }: Props) {
  if (!badges || badges.length === 0) return null

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1.5">
        {badges.map(badgeId => {
          const cfg = BADGE_CONFIG[badgeId]
          if (!cfg) return null

          return (
            <Tooltip key={badgeId}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`
                    flex items-center gap-1 cursor-default border font-medium
                    ${cfg.className}
                    ${size === "sm" ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5"}
                  `}
                >
                  {cfg.icon}
                  {cfg.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{cfg.description}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
