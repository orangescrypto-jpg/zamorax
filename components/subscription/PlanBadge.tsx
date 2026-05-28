import { Badge } from "@/components/ui/badge"
import { Crown, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlanBadgeProps {
  plan: "free" | "starter" | "pro" | null
  className?: string
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  if (!plan || plan === "free") return null

  const isPro = plan === "pro"

  return (
    <Badge
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5",
        isPro ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white" : "bg-muted text-muted-foreground",
        className
      )}
    >
      {isPro ? <Crown className="h-3 w-3 text-white" /> : <Star className="h-3 w-3" />}
      {isPro ? "Pro Seller" : "Starter"}
    </Badge>
  )
}
