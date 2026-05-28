"use client"

import {AdminService, query, orderBy, onSnapshot, where, Timestamp} from "@/src/services"
// app/(admin)/admin/payments/page.tsx
// ─────────────────────────────────────────────────────────────────
// Admin panel: view and confirm pending manual payments.
// Covers: orders, subscriptions, and boosts.
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  CheckCircle2, Clock, Loader2, RefreshCw,
  ShoppingBag, Zap, CreditCard, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PendingPayment {
  id: string
  reference: string
  purpose: "order" | "subscription" | "boost"
  amount: number
  userId: string
  metadata: Record<string, any>
  status: string
  adminConfirmed: boolean
  createdAt: Timestamp
}

const PURPOSE_ICON = {
  order:        <ShoppingBag className="h-4 w-4" />,
  subscription: <CreditCard className="h-4 w-4" />,
  boost:        <Zap className="h-4 w-4" /> }

const PURPOSE_COLOR = {
  order:        "bg-blue-100 text-blue-800",
  subscription: "bg-purple-100 text-purple-800",
  boost:        "bg-yellow-100 text-yellow-800" }

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

function formatDate(ts: Timestamp | undefined) {
  if (!ts) return "—"
  return ts.toDate().toLocaleString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit" })
}

export default function AdminPaymentsPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()

  const [payments, setPayments]         = useState<PendingPayment[]>([])
  const [loading, setLoading]           = useState(true)
  const [confirming, setConfirming]     = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "confirmed">("pending")
  const [filterPurpose, setFilterPurpose] = useState<"all" | "order" | "subscription" | "boost">("all")
  const [search, setSearch]             = useState("")

  useEffect(() => {
    const constraints: import("firebase/firestore").QueryConstraint[] = [orderBy("createdAt", "desc")]
    if (filterStatus === "pending")   constraints.unshift(where("adminConfirmed", "==", false))
    if (filterStatus === "confirmed") constraints.unshift(where("adminConfirmed", "==", true))

    const q = AdminService._ref_("pendingPayments", [...constraints])
    const unsub = onSnapshot(q, docs => {
      setPayments(docs.docs.docs.map(d => ({ ...d.data(), id: d.id } as PendingPayment)))
      setLoading(false)
    })
    return unsub
  }, [filterStatus])

  const filtered = payments.filter(p => {
    if (filterPurpose !== "all" && p.purpose !== filterPurpose) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        p.reference.toLowerCase().includes(s) ||
        p.userId.toLowerCase().includes(s) ||
        p.metadata?.orderId?.toLowerCase().includes(s)
      )
    }
    return true
  })

  const handleConfirm = async (payment: PendingPayment) => {
    setConfirming(payment.id)
    try {
      const res = await fetch("/api/payment/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference:      payment.reference,
          adminId:        user?.uid,
          purpose:        payment.purpose,
          orderId:        payment.metadata?.orderId,
          boostId:        payment.metadata?.boostId,
          subscriptionId: payment.metadata?.subscriptionId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({
        title:       "✅ Payment Confirmed",
        description: `${payment.reference} — ${payment.purpose} activated.`,
        variant:     "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setConfirming(null)
    }
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pending Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Confirm manual bank transfers from buyers
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3.5 w-3.5" />
          {payments.filter(p => !p.adminConfirmed).length} pending
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference or user ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all"|"pending"|"confirmed")}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPurpose} onValueChange={(v) => setFilterPurpose(v as "all"|"order"|"subscription"|"boost")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="order">Orders</SelectItem>
            <SelectItem value="subscription">Subscriptions</SelectItem>
            <SelectItem value="boost">Boosts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
          <p className="font-medium">No pending payments</p>
          <p className="text-sm mt-1">All payments are confirmed.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden divide-y divide-border">
          {filtered.map(payment => (
            <div key={payment.id} className="flex items-center justify-between px-5 py-4 gap-4 hover:bg-muted/30 transition-colors">

              <div className="min-w-0 flex-1 space-y-1">
                {/* Reference + purpose */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold truncate">{payment.reference}</span>
                  <Badge className={`gap-1 text-xs ${PURPOSE_COLOR[payment.purpose]}`}>
                    {PURPOSE_ICON[payment.purpose]}
                    {payment.purpose}
                  </Badge>
                  {payment.adminConfirmed && (
                    <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmed
                    </Badge>
                  )}
                </div>

                {/* Amount + date */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{formatKobo(payment.amount)}</span>
                  <span>·</span>
                  <span>{formatDate(payment.createdAt)}</span>
                  {payment.metadata?.orderId && (
                    <>
                      <span>·</span>
                      <span>Order: {payment.metadata.orderId.slice(-6).toUpperCase()}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action */}
              {!payment.adminConfirmed && (
                <Button
                  size="sm"
                  onClick={() => handleConfirm(payment)}
                  disabled={confirming === payment.id}
                  className="shrink-0 bg-green-600 hover:bg-green-700 text-white"
                >
                  {confirming === payment.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  }
                  Confirm Received
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
