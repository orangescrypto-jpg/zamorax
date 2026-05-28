"use client"

import {AdminService, query, orderBy, onSnapshot, where} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { WithdrawalForm } from "@/components/dashboard/WithdrawalForm"
import { FeeBreakdown } from "@/components/shared/FeeBreakdown"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { Loader2, TrendingUp, Wallet, ArrowDownRight } from "lucide-react"
import {DocumentData} from "@/src/services"

type Order = DocumentData & { id: string }

export default function SellerEarningsPage() {
  const uid = useAuthStore((s) => s.user?.uid)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ gross: 0, net: 0, available: 0, withdrawn: 0 })

  useEffect(() => {
    if (!uid) return
    const q = AdminService._ref_("orders", [where("sellerId", "==", uid), orderBy("createdAt", "desc")])

    const unsub = onSnapshot(q, docs => {
      const items: Order[] = docs.map(d => ({ ...d }))
      setOrders(items)

      let gross = 0, net = 0, withdrawn = 0
      items.forEach(o => {
        if (o.status === "completed") {
          gross += o.itemPrice || 0
          net += o.sellerPayout || 0
          if (o.withdrawalStatus === "completed") withdrawn += o.sellerPayout || 0
        }
      })
      setSummary({ gross, net, available: net - withdrawn, withdrawn })
      setLoading(false)
    }, () => setLoading(false))

    return unsub
  }, [uid])

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold">Earnings & Withdrawals</h1>
        <p className="text-muted-foreground">Track your payouts, fees, and manage bank withdrawals.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Gross Sales</p>
          <p className="text-2xl font-bold">{formatPrice(summary.gross)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Wallet className="h-4 w-4" /> Net Earnings</p>
          <p className="text-2xl font-bold text-accent">{formatPrice(summary.net)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><ArrowDownRight className="h-4 w-4" /> Available</p>
          <p className="text-2xl font-bold text-primary">{formatPrice(summary.available)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 space-y-1">
          <p className="text-sm text-muted-foreground">Total Withdrawn</p>
          <p className="text-2xl font-bold text-muted-foreground">{formatPrice(summary.withdrawn)}</p>
        </CardContent></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Withdrawal Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Withdraw to Bank</CardTitle></CardHeader>
            <CardContent><WithdrawalForm amount={summary.available} /></CardContent>
          </Card>
          <div className="mt-6">
            <FeeBreakdown amount={summary.gross} transactionType="sale" />
          </div>
        </div>

        {/* Transaction History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map(o => (
                        <TableRow key={o.id}>
                          {/* FIX: use CSS truncate instead of hard slice(0,20)+"..." */}
                          <TableCell className="font-medium max-w-[160px]">
                            <span className="block truncate">{o.itemTitle || "—"}</span>
                          </TableCell>
                          <TableCell>{o.createdAt?.toDate?.().toLocaleDateString() ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={o.status === "completed" ? "success" : "outline"}>
                              {o.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {o.status === "completed" ? formatPrice(o.sellerPayout || 0) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
