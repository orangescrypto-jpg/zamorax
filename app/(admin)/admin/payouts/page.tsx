"use client"

import { AdminService } from "@/src/services"
// app/(admin)/admin/payouts/page.tsx
// FIX: this page previously read from "payoutRequests" using Firestore-era
// APIs (query/orderBy/onSnapshot/serverTimestamp, payout.createdAt?.toDate())
// that were never migrated to D1 and don't exist on AdminService at all —
// so this page always showed "No payout requests found", regardless of how
// many real withdrawals sellers made. The actual withdrawal flow
// (/api/seller/withdraw) writes to the `withdrawals` table, which is what
// /admin/withdrawals already reads correctly.
//
// This page is now a stats-first summary over that SAME real table —
// approve/reject/mark-paid actions live on /admin/withdrawals (it already
// has the full dialog flow for rejection reasons and payment proof), so
// this page focuses on the "at a glance" numbers plus a searchable list,
// rather than duplicating those action buttons.

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CreditCard, Loader2, CheckCircle, XCircle,
  Search, Clock, AlertTriangle, Banknote, ArrowRight,
} from "lucide-react"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  approved:  { label: "Approved",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Paid",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700 border-red-200" },
}

function formatKobo(amount: number) {
  // FIX: amount is stored as REAL kobo on the real `withdrawals` table
  // (confirmed via sqlite_master), same unit the rest of the app uses.
  return `₦${(amount / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
}

function formatDate(value: unknown): string {
  if (!value) return "—"
  const d = new Date(String(value))
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
}

export default function AdminPayoutsPage() {
  const [withdrawals, setWithdrawals] = useState<Record<string, unknown>[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState("")
  const [activeTab,   setActiveTab]   = useState("pending")

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const rows = await AdminService.getCollection("withdrawals") as Record<string, unknown>[]
        if (!active) return
        // Same normalization as /admin/withdrawals — the real column is
        // user_id, not sellerId/seller_id.
        const normalized = rows.map(r => ({
          ...r,
          sellerId:   String(r.sellerId ?? r.userId ?? r.user_id ?? ""),
          sellerName: r.sellerName ?? r.seller_name ?? "Unknown Seller",
          amount:     Number(r.amount ?? 0),
        }))
        setWithdrawals(normalized)
      } catch { /* keep previous list on transient errors */ }
      finally { if (active) setLoading(false) }
    }
    load()
    const interval = setInterval(load, 15_000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const filtered = withdrawals.filter(p => {
    const matchesTab = activeTab === "all" || p.status === activeTab
    const s = search.toLowerCase()
    const matchesSearch = !search ||
      String(p.sellerName ?? "").toLowerCase().includes(s) ||
      String(p.accountNumber ?? p.account_number ?? "").includes(search) ||
      String(p.bankName ?? p.bank_name ?? "").toLowerCase().includes(s)
    return matchesTab && matchesSearch
  })

  const now = new Date()
  const thisMonth = (d: unknown) => {
    const dt = new Date(String(d))
    return !isNaN(dt.getTime()) && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
  }

  const totals = {
    pendingCount:  withdrawals.filter(p => p.status === "pending").length,
    pendingAmount: withdrawals.filter(p => p.status === "pending").reduce((a, p) => a + Number(p.amount || 0), 0),
    paidThisMonth: withdrawals.filter(p => p.status === "completed" && thisMonth(p.updatedAt ?? p.updated_at)).length,
    paidAmount:    withdrawals.filter(p => p.status === "completed").reduce((a, p) => a + Number(p.amount || 0), 0),
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold">Payouts</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of seller wallet payout requests.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/withdrawals">
            Manage on Withdrawals <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending requests", value: totals.pendingCount, icon: Clock, color: "text-amber-600" },
          { label: "Pending amount",   value: formatKobo(totals.pendingAmount), icon: AlertTriangle, color: "text-amber-600" },
          { label: "Paid this month",  value: totals.paidThisMonth, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Paid amount",      value: formatKobo(totals.paidAmount), icon: Banknote, color: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-start gap-3">
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search seller, bank, account…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({withdrawals.filter(p => p.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({withdrawals.filter(p => p.status === "approved").length})</TabsTrigger>
          <TabsTrigger value="completed">Paid</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {["pending", "approved", "completed", "rejected", "all"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No payout requests found.</p>
                </CardContent>
              </Card>
            ) : filtered.map(payout => {
              const cfg = STATUS_CONFIG[String(payout.status)] ?? STATUS_CONFIG.pending
              return (
                <Card key={String(payout.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{String(payout.sellerName)}</p>
                          <Badge className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-2xl font-bold text-primary">
                          {formatKobo(Number(payout.amount || 0))}
                        </p>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>
                            {String(payout.bankName ?? payout.bank_name ?? "")} • {String(payout.accountNumber ?? payout.account_number ?? "")} • {String(payout.accountName ?? payout.account_name ?? "")}
                          </p>
                          <p>Requested {formatDate(payout.createdAt ?? payout.created_at)}</p>
                          {payout.status === "completed" && (
                            <p className="text-emerald-600">Paid {formatDate(payout.updatedAt ?? payout.updated_at)}</p>
                          )}
                          {(payout.rejectionReason ?? payout.rejection_reason) ? (
                            <p className="text-red-600">Reason: {String(payout.rejectionReason ?? payout.rejection_reason)}</p>
                          ) : null}
                        </div>
                      </div>

                      {payout.status === "pending" && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          <Link href="/admin/withdrawals" className="flex items-center gap-1">
                            Act on Withdrawals <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
