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
type WalletTx = DocumentData & { id: string }

export default function SellerEarningsPage() {
  const uid = useAuthStore((s) => s.user?.uid)
  const [orders, setOrders] = useState<Order[]>([])
  const [walletTxs, setWalletTxs] = useState<WalletTx[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ gross: 0, net: 0, available: 0, withdrawn: 0 })

  useEffect(() => {
    if (!uid) return
    const q = AdminService._ref_("orders", [where("sellerId", "==", uid), orderBy("createdAt", "desc")])

    const unsub = onSnapshot(q, docs => {
      const items: Order[] = docs.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      setOrders(items)

      let gross = 0, net = 0
      items.forEach(o => {
        if (o.status === "completed") {
          gross += o.itemPrice || 0
          net += o.sellerPayout || 0
        }
      })
      // FIX: "Available" was computed as net minus a per-order sum of
      // o.withdrawalStatus === "completed" — but nothing in the codebase
      // ever sets orders.withdrawalStatus (POST /api/seller/withdraw only
      // touches seller_wallets.balance, the withdrawals table, and
      // wallet_transactions — it never writes back to the order row at
      // all). That condition was always false, so "withdrawn" was always
      // 0 and Available never actually dropped after a real withdrawal.
      // seller_wallets.balance is the one place a withdrawal genuinely
      // gets deducted — read Available from there instead, and derive
      // Total Withdrawn as net minus that live balance so it stays
      // consistent with whatever's actually been paid out.
      setSummary(prev => ({ ...prev, gross, net, withdrawn: Math.max(0, net - prev.available) }))
    }, () => setLoading(false))

    return unsub
  }, [uid])

  // Poll the real wallet balance — this is what /api/seller/withdraw
  // actually deducts from, so it's the only source Available should read.
  useEffect(() => {
    if (!uid) return
    let active = true
    const load = async () => {
      try {
        const wallet = await AdminService.getDoc("seller_wallets", uid) as Record<string, unknown> | null
        if (!active) return
        const balance = Number(wallet?.balance ?? 0)
        setSummary(prev => ({ ...prev, available: balance, withdrawn: Math.max(0, prev.net - balance) }))
        setLoading(false)
      } catch {
        if (active) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 15_000)
    return () => { active = false; clearInterval(interval) }
  }, [uid])

  // Withdrawal requests — Transaction History previously only showed order
  // sales, so a seller had no way to see their withdrawal history (pending,
  // paid, or failed) in the same place. wallet_transactions already has a
  // "payout" row per withdrawal request (written by /api/seller/withdraw) —
  // pull those in and merge with orders below instead of adding a second table.
  useEffect(() => {
    if (!uid) return
    let active = true
    const load = async () => {
      try {
        const rows = await AdminService.getCollection("wallet_transactions", [
          where("userId", "==", uid),
          orderBy("createdAt", "desc"),
        ]) as WalletTx[]
        if (active) setWalletTxs(rows.filter(t => t.type === "payout"))
      } catch {
        // non-fatal — sales history still shows even if this fails
      }
    }
    load()
    const interval = setInterval(load, 15_000)
    return () => { active = false; clearInterval(interval) }
  }, [uid])

  // Merge orders (sales) and wallet_transactions (withdrawals) into one
  // chronological feed for the Transaction History table.
  type HistoryRow = {
    id: string
    label: string
    date?: string
    status: string
    amount: number
    kind: "sale" | "withdrawal"
  }
  const historyRows: HistoryRow[] = [
    ...orders.map(o => ({
      id: o.id,
      label: o.itemTitle || "—",
      date: o.createdAt,
      status: o.status,
      amount: o.sellerPayout || 0,
      kind: "sale" as const,
    })),
    ...walletTxs.map(t => ({
      id: t.id,
      label: t.description || "Withdrawal",
      date: t.createdAt,
      status: t.status || "pending",
      amount: t.amount || 0,
      kind: "withdrawal" as const,
    })),
  ].sort((a, b) => {
    const at = a.date ? new Date(String(a.date)).getTime() : 0
    const bt = b.date ? new Date(String(b.date)).getTime() : 0
    return bt - at
  })

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
              {historyRows.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyRows.map(row => (
                        <TableRow key={`${row.kind}-${row.id}`}>
                          <TableCell className="font-medium max-w-[160px]">
                            <span className="block truncate">
                              {row.kind === "withdrawal" ? "↓ " : ""}{row.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.date ? new Date(String(row.date)).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.status === "completed" ? "success" : "outline"}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {row.kind === "withdrawal" ? "− " : ""}
                            {row.kind === "sale" && row.status !== "completed" ? "—" : formatPrice(row.amount)}
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
