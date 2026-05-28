"use client"

import { useAuthStore } from "@/store/authStore"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { limit } from "@/src/services"

const LIMITS = { free: 5, starter: 20, pro: 999 }

export function PlanLimitWarning() {
  const user = useAuthStore((state) => state.user)
  if (!user) return null

  const limit = LIMITS[user.plan as keyof typeof LIMITS] || 5
  const used = user.activeListingCount || 0
  const remaining = Math.max(0, limit - used)
  const isNearLimit = remaining <= 2 && user.plan !== "pro"

  if (user.plan === "pro" || !isNearLimit) return null

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <AlertCircle className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary">Listing Limit Warning</AlertTitle>
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
        <span>You've used {used}/{limit} active listings on your {user.plan} plan. Only {remaining} remaining.</span>
        <Button size="sm" variant="link" className="px-0 h-auto" asChild>
          <Link href="/pricing" className="flex items-center gap-1 text-primary font-medium">
            Upgrade Plan <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
