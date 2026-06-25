"use client"

import { AdminService } from "@/src/services"

import { useEffect, useState } from "react"
import { formatPrice } from "@/lib/utils"
import { getCategoryBySlug } from "@/constants/categories"
import { doc } from "@/src/services"

export function CategoryRevenueBreakdown() {
  const [data, setData] = useState<Record<string, { gmv: number; commission: number }>>({})
  const [totalRev, setTotalRev] = useState(0)

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection("orders",  docs => {
      const catData: Record<string, { gmv: number; commission: number }> = {}
      let total = 0
      docs.forEach(doc => {
        const d = doc.data()
        if (d.status === "completed") {
          const cat = d.categorySlug || "other"
          if (!catData[cat]) catData[cat] = { gmv: 0, commission: 0 }
          catData[cat].gmv += d.totalAmount || 0
          catData[cat].commission += d.commissionAmount || 0
          total += d.commissionAmount || 0
        }
      })
      setTotalRev(total)
      setData(catData)
    })
    return unsub
  }, [])

  if (Object.keys(data).length === 0) return <p className="text-muted-foreground text-center py-4">No completed transactions yet.</p>

  const sorted = Object.entries(data).sort((a: any, b: any) => b[1].commission - a[1].commission)

  return (
    <div className="space-y-3">
      {sorted.map(([slug, { gmv, commission }]) => {
        const cat = getCategoryBySlug(slug)
        const pct = totalRev > 0 ? ((commission / totalRev) * 100).toFixed(1) : "0.0"
        return (
          <div key={slug} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border">
            <div>
              <p className="font-medium">{cat?.name || slug}</p>
              <p className="text-xs text-muted-foreground">GMV: {formatPrice(gmv)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-accent">{formatPrice(commission)}</p>
              <p className="text-xs text-muted-foreground">{pct}% of revenue</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
