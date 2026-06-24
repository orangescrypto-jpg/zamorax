"use client"

import { useAuthStore } from "@/store/authStore"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { limit } from "@/src/services"

const LIMITS: Record<string, number> = { free: 5, starter: 20, pro: 999 }

export function ListingLimitProgress() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  const limit = LIMITS[user.plan as keyof typeof LIMITS] || 5
  const used = user.activeListingCount || 0
  const remaining = Math.max(0, limit - used)
  const pct = Math.min((used / limit) * 100, 100)
  const isNearLimit = remaining <= 2 && user.plan !== "pro"

  return (
    <div className="p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Plan Usage: {used} / {limit === 999 ? "Unlimited" : limit} listings</span>
        <span className={`text-sm font-bold ${isNearLimit ? "text-destructive" : "text-accent"}`}>
          {remaining} {remaining === 1 ? "slot" : "slots"} left
        </span>
      </div>
      <Progress value={pct} className={`h-2 ${isNearLimit ? "bg-red-100" : ""}`} />
      
      {isNearLimit && (
        <div className="mt-3 flex items-center gap-2 text-sm bg-amber-50 text-amber-800 p-2 rounded border border-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">You're close to your plan limit. Upgrade to keep posting.</span>
          <Button variant="link" size="sm" className="p-0 h-auto text-amber-700 underline" asChild>
            <Link href="/pricing">Upgrade <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
          </Button>
        </div>
      )}
    </div>
  )
}
