"use client"

import {AdminService, query, orderBy, onSnapshot, serverTimestamp} from "@/src/services"
// app/(admin)/admin/payouts/page.tsx
// Admin view of all seller wallet payout requests — approve, reject, mark paid.

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CreditCard, Loader2, CheckCircle, XCircle,
  Search, Clock, AlertTriangle, Banknote,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  approved:  { label: "Approved",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  paid:      { label: "Paid",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700 border-red-200" },
}

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
}

export default function AdminPayoutsPage() {
  const { toast } = useToast()
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("pending")

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection("payoutRequests", snap => {
        setPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() }, [orderBy("createdAt", "desc")])))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const updateStatus = async (id: string, status: string, extra?: Record<string, any>) => {
    setProcessing(id)
    try {
      await AdminService.updateDoc("payoutRequests", id, {
        status,
        [`${status}At`]: serverTimestamp(),
        ...extra,
      })
      toast({ title: `Payout ${status}`, description: `Request has been ${status}.` })
    } catch {
      toast({ title: "Error", description: "Could not update payout.", variant: "destructive" })
    } finally {
      setProcessing(null)
    }
  }

  const filtered = payouts.filter(p => {
    const matchesTab = activeTab === "all" || p.status === activeTab
    const matchesSearch = !search ||
      p.sellerName?.toLowerCase().includes(search.toLowerCase()) ||
      p.accountNumber?.includes(search) ||
      p.bankName?.toLowerCase().includes(search.toLowerCase())
    return matchesTab && matchesSearch
  })

  const totals = {
    pending: payouts.filter(p => p.status === "pending").reduce((a, p) => a + (p.amountKobo || 0), 0),
    paid: payouts.filter(p => p.status === "paid").reduce((a, p) => a + (p.amountKobo || 0), 0),
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Payouts</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage seller wallet payout requests.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Pending requests", value: payouts.filter(p => p.status === "pending").length, icon: Clock, color: "text-amber-600" },
          { label: "Pending amount", value: formatKobo(totals.pending), icon: AlertTriangle, color: "text-amber-600" },
          { label: "Paid this month", value: payouts.filter(p => p.status === "paid").length, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Paid amount", value: formatKobo(totals.paid), icon: Banknote, color: "text-emerald-600" },
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
          <TabsTrigger value="pending">Pending ({payouts.filter(p => p.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({payouts.filter(p => p.status === "approved").length})</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {["pending", "approved", "paid", "rejected", "all"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No payout requests found.</p>
                </CardContent>
              </Card>
            ) : filtered.map(payout => {
              const cfg = STATUS_CONFIG[payout.status] ?? STATUS_CONFIG.pending
              return (
                <Card key={payout.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{payout.sellerName || "Unknown Seller"}</p>
                          <Badge className={`text-xs border ${cfg.color}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-2xl font-bold text-primary">
                          {formatKobo(payout.amountKobo || 0)}
                        </p>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>{payout.bankName} • {payout.accountNumber} • {payout.accountName}</p>
                          <p>Requested {payout.createdAt?.toDate ? formatDistanceToNow(payout.createdAt.toDate(), { addSuffix: true }) : "—"}</p>
                          {payout.paidAt && <p className="text-emerald-600">Paid {formatDistanceToNow(payout.paidAt.toDate(), { addSuffix: true })}</p>}
                          {payout.rejectedReason && <p className="text-red-600">Reason: {payout.rejectedReason}</p>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {payout.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-primary text-white"
                              disabled={processing === payout.id}
                              onClick={() => updateStatus(payout.id, "approved")}
                            >
                              {processing === payout.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle className="h-3 w-3 mr-1" />Approve</>}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/5"
                              disabled={processing === payout.id}
                              onClick={() => updateStatus(payout.id, "rejected", { rejectedReason: "Manual review rejection" })}
                            >
                              <XCircle className="h-3 w-3 mr-1" />Reject
                            </Button>
                          </>
                        )}
                        {payout.status === "approved" && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={processing === payout.id}
                            onClick={() => updateStatus(payout.id, "paid")}
                          >
                            {processing === payout.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Banknote className="h-3 w-3 mr-1" />Mark Paid</>}
                          </Button>
                        )}
                      </div>
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
