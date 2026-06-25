"use client"

import { AdminService } from "@/src/services"

import { useEffect, useState } from "react"
import { formatPrice } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle } from "lucide-react"
import { doc } from "@/src/services"

export function InsurancePoolMonitor() {
  const [pool, setPool] = useState({ collected: 0, claimed: 0, net: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection("orders",  docs => {
      let collected = 0, claimed = 0
      docs.forEach((docSnap: any) => {
        const d = docSnap.data()
        collected += d.insuranceAmount || 0
        if (d.status === "refunded" || d.resolution === "buyer_refund") {
          claimed += d.insuranceAmount || 0
        }
      })
      setPool({ collected, claimed, net: collected - claimed })
      setLoading(false)
    })
    return unsub
  }, [])

  if (loading) return <div className="h-24 bg-muted animate-pulse rounded" />

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Total Collected (0.5%)</span>
        <span className="font-bold text-emerald-600">{formatPrice(pool.collected)}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Claims Payouts</span>
        <span className="font-bold text-red-600">-{formatPrice(pool.claimed)}</span>
      </div>
      <div className="h-px bg-border my-2" />
      <div className="flex justify-between items-center text-lg">
        <span className="font-bold">Net Insurance Balance</span>
        <span className="font-bold text-primary">{formatPrice(pool.net)}</span>
      </div>
      <Progress value={pool.collected > 0 ? (pool.net / pool.collected) * 100 : 0} className="h-2" />
      <p className="text-xs text-muted-foreground text-center">Pool health: {pool.net >= 0 ? "Secure" : "Negative - Requires Admin Review"}</p>
    </div>
  )
}
