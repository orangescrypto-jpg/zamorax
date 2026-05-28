"use client"

import { AdminService } from "@/src/services"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"
import { Loader2, Wallet, TrendingUp, Shield, CreditCard, Sparkles, Banknote } from "lucide-react"
import { doc } from "@/src/services"

export function RevenueStats() {
  const [stats, setStats] = useState({ gmv: 0, commission: 0, insurance: 0, mrr: 0, boostRevenue: 0, withdrawalFees: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubOrders = AdminService.subscribeToCollection("orders",  docs => {
      let gmv = 0, commission = 0, insurance = 0
      docs.forEach(doc => {
        const d = doc.data()
        gmv += d.totalAmount || 0
        commission += d.commissionAmount || 0
        insurance += d.insuranceAmount || 0
      })
      setStats(s => ({ ...s, gmv, commission, insurance }))
    })

    const unsubSubs = AdminService.subscribeToCollection("subscriptions",  docs => {
      let mrr = 0
      docs.forEach(doc => {
        const d = doc.data()
        if (d.isActive && d.plan !== "free") mrr += d.amount || 0
      })
      setStats(s => ({ ...s, mrr }))
    })

    const unsubBoosts = AdminService.subscribeToCollection("boosts",  docs => {
      let rev = 0
      docs.forEach(doc => rev += doc.amount || 0)
      setStats(s => ({ ...s, boostRevenue: rev }))
    })

    const unsubWithdrawals = AdminService.subscribeToCollection("withdrawals",  docs => {
      let fees = 0
      docs.forEach(doc => {
        if (doc.status === "completed") fees += doc.fee || 0
      })
      setStats(s => ({ ...s, withdrawalFees: fees }))
      setLoading(false)
    })

    return () => { unsubOrders(); unsubSubs(); unsubBoosts(); unsubWithdrawals() }
  }, [])

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />

  const items = [
    { label: "Total GMV", value: formatPrice(stats.gmv), icon: <Wallet />, color: "text-blue-600 bg-blue-50" },
    { label: "Commission Earned", value: formatPrice(stats.commission), icon: <TrendingUp />, color: "text-emerald-600 bg-emerald-50" },
    { label: "Insurance Pool", value: formatPrice(stats.insurance), icon: <Shield />, color: "text-purple-600 bg-purple-50" },
    { label: "Subscription MRR", value: formatPrice(stats.mrr), icon: <CreditCard />, color: "text-amber-600 bg-amber-50" },
    { label: "Boost Revenue", value: formatPrice(stats.boostRevenue), icon: <Sparkles />, color: "text-pink-600 bg-pink-50" },
    { label: "Withdrawal Fees", value: formatPrice(stats.withdrawalFees), icon: <Banknote />, color: "text-gray-600 bg-gray-50" },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map(i => (
        <Card key={i.label}>
          <CardContent className="p-4 flex flex-col items-start gap-2">
            <div className={`p-2 rounded-lg ${i.color}`}>{i.icon}</div>
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className="text-lg font-bold">{i.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
