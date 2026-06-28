"use client"
// app/(admin)/admin/payments/page.tsx
// Admin panel: view and confirm pending manual payments.
// Covers: orders, subscriptions, boosts, and cart_orders.

import { useEffect, useState, useCallback } from "react"
import { AdminService } from "@/src/services"
import { useAuthStore } from "@/store/authStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  CheckCircle2, Clock, Loader2,
  ShoppingBag, Zap, CreditCard, Search,
  ImageIcon, ExternalLink, ShoppingCart, Package2, RefreshCw,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CartItemGroup } from "@/src/types"

interface PendingPayment {
  id:             string
  reference:      string
  purpose:        "order" | "subscription" | "boost" | "cart_order"
  amount:         number
  userId:         string
  metadata?:      Record<string, any>
  cartItems?:     CartItemGroup[]    // only present for cart_order
  status:         string
  adminConfirmed: boolean
  proofUrl?:      string
  buyerName?:     string
  createdAt:      string | null
}

const PURPOSE_ICON = {
  order:        <ShoppingBag className="h-4 w-4" />,
  subscription: <CreditCard  className="h-4 w-4" />,
  boost:        <Zap         className="h-4 w-4" />,
  cart_order:   <ShoppingCart className="h-4 w-4" />,
}

const PURPOSE_COLOR = {
  order:        "bg-blue-100 text-blue-800",
  subscription: "bg-purple-100 text-purple-800",
  boost:        "bg-yellow-100 text-yellow-800",
  cart_order:   "bg-emerald-100 text-emerald-800",
}

function formatKobo(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

function formatDate(ts: string | null | undefined) {
  if (!ts) return "—"
  return new Date(ts).toLocaleString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function AdminPaymentsPage() {
  const { user }   = useAuthStore()
  const { toast }  = useToast()

  const [payments,       setPayments]       = useState<PendingPayment[]>([])
  const [loading,        setLoading]        = useState(true)
  const [confirming,     setConfirming]     = useState<string | null>(null)
  const [filterStatus,   setFilterStatus]   = useState<"all" | "pending" | "confirmed">("pending")
  const [filterPurpose,  setFilterPurpose]  = useState<"all" | "order" | "subscription" | "boost" | "cart_order">("all")
  const [search,         setSearch]         = useState("")
  const [proofOpen,      setProofOpen]      = useState(false)
  const [proofImageUrl,  setProofImageUrl]  = useState<string | null>(null)
  const [expandedCart,   setExpandedCart]   = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      // AdminService.getCollection polls D1 directly — no Firestore/onSnapshot
      const rows = await AdminService.getCollection("pending_payments") as Record<string, any>[]
      const mapped: PendingPayment[] = rows.map(r => ({
        id:             String(r.id ?? ""),
        reference:      String(r.reference ?? ""),
        purpose:        (r.purpose ?? "order") as PendingPayment["purpose"],
        amount:         Number(r.amount ?? 0),
        userId:         String(r.userId ?? r.user_id ?? ""),
        status:         String(r.status ?? ""),
        adminConfirmed: Boolean(r.adminConfirmed ?? r.admin_confirmed),
        proofUrl:       r.proofUrl ?? r.proof_url ?? undefined,
        buyerName:      r.buyerName ?? r.buyer_name ?? undefined,
        createdAt:      r.createdAt ?? r.created_at ?? null,
        metadata:       (() => {
          try { return typeof r.metadata === "string" ? JSON.parse(r.metadata) : (r.metadata ?? {}) }
          catch { return {} }
        })(),
        cartItems:      (() => {
          try { return typeof r.cartItems === "string" ? JSON.parse(r.cartItems) : (r.cartItems ?? undefined) }
          catch { return undefined }
        })(),
        isOfferOrder:   Boolean(r.isOfferOrder ?? r.is_offer_order ?? r.metadata?.isOfferOrder),
        offerId:        r.offerId ?? r.offer_id ?? r.metadata?.offerId ?? undefined,
        originalPrice:  Number(r.originalPrice ?? r.original_price ?? r.metadata?.originalPrice ?? 0),
      }))
      // Sort by createdAt desc
      mapped.sort((a, b) => {
        if (!a.createdAt) return 1
        if (!b.createdAt) return -1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      setPayments(mapped)
    } catch (err: any) {
      toast({ title: "Failed to load payments", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const filtered = payments.filter(p => {
    if (filterStatus === "pending"   && p.adminConfirmed)  return false
    if (filterStatus === "confirmed" && !p.adminConfirmed) return false
    if (filterPurpose !== "all" && p.purpose !== filterPurpose) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        p.reference.toLowerCase().includes(s) ||
        p.userId.toLowerCase().includes(s)    ||
        p.metadata?.orderId?.toLowerCase().includes(s) ||
        p.buyerName?.toLowerCase().includes(s)
      )
    }
    return true
  })

  const handleConfirm = async (payment: PendingPayment) => {
    setConfirming(payment.id)
    try {
      // Cart orders go to /api/cart/confirm; everything else to /api/payment/confirm
      const isCart   = payment.purpose === "cart_order"
      const endpoint = isCart ? "/api/cart/confirm" : "/api/payment/confirm"

      const body = isCart
        ? { reference: payment.reference, adminId: user?.uid }
        : {
            reference:      payment.reference,
            adminId:        user?.uid,
            purpose:        payment.purpose,
            orderId:        payment.metadata?.orderId,
            boostId:        payment.metadata?.boostId,
            adBoostId:      payment.metadata?.adBoostId,
            subscriptionId: payment.metadata?.subscriptionId,
          }

      const res  = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({
        title:       "✅ Payment Confirmed",
        description: `${payment.reference} — ${isCart ? "cart order" : payment.purpose} activated.`,
        variant:     "success",
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setConfirming(null)
    }
  }

  const openProof = (url: string) => {
    setProofImageUrl(url)
    setProofOpen(true)
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
        <Button variant="outline" size="sm" onClick={fetchPayments} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference, user, or buyer name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filterStatus}
          onValueChange={v => setFilterStatus(v as "all" | "pending" | "confirmed")}
        >
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterPurpose}
          onValueChange={v => setFilterPurpose(v as any)}
        >
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="order">Orders</SelectItem>
            <SelectItem value="cart_order">Cart Orders 🛒</SelectItem>
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
          {filtered.map(payment => {
            const isCart = payment.purpose === "cart_order"
            const cartItems = payment.cartItems ?? []
            const totalItems = cartItems.reduce((s, g) => s + g.lineItems.reduce((ss, l) => ss + l.qty, 0), 0)
            const isExpanded = expandedCart === payment.id

            return (
              <div key={payment.id} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">

                    {/* Reference + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold truncate">{payment.reference}</span>
                      <Badge className={`gap-1 text-xs ${PURPOSE_COLOR[payment.purpose]}`}>
                        {PURPOSE_ICON[payment.purpose]}
                        {isCart ? "Cart Order 🛒" : payment.purpose}
                      </Badge>
                      {payment.adminConfirmed && (
                        <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Confirmed
                        </Badge>
                      )}
                      {(payment as any).isOfferOrder && (
                        <Badge className="bg-orange-100 text-orange-800 text-xs gap-1">
                          🏷️ Offer Price
                        </Badge>
                      )}
                      {payment.proofUrl ? (
                        <Badge className="bg-sky-100 text-sky-800 text-xs gap-1">
                          <ImageIcon className="h-3 w-3" /> Proof attached
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                          <ImageIcon className="h-3 w-3" /> No proof
                        </Badge>
                      )}
                    </div>

                    {/* Amount + date + summary */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="font-semibold text-foreground">{formatKobo(payment.amount)}</span>
                      <span>·</span>
                      <span>{formatDate(payment.createdAt)}</span>
                      {payment.buyerName && (
                        <><span>·</span><span>{payment.buyerName}</span></>
                      )}
                      {isCart && cartItems.length > 0 && (
                        <><span>·</span>
                        <button
                          onClick={() => setExpandedCart(isExpanded ? null : payment.id)}
                          className="text-primary text-xs hover:underline"
                        >
                          {totalItems} item{totalItems !== 1 ? "s" : ""} from {cartItems.length} seller{cartItems.length !== 1 ? "s" : ""} {isExpanded ? "▲" : "▼"}
                        </button>
                        </>
                      )}
                      {payment.metadata?.orderId && (
                        <><span>·</span><span>Order: {payment.metadata.orderId.slice(-6).toUpperCase()}</span></>
                      )}
                    </div>

                    {/* Cart order breakdown */}
                    {isCart && isExpanded && cartItems.length > 0 && (
                      <div className="mt-2 rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-semibold">Seller</th>
                              <th className="text-left px-3 py-2 font-semibold">Items</th>
                              <th className="text-right px-3 py-2 font-semibold">Subtotal</th>
                              <th className="text-right px-3 py-2 font-semibold">Delivery</th>
                              <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Platform Fee</th>
                              <th className="text-right px-3 py-2 font-semibold text-green-700">Seller Payout</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {cartItems.map((group, i) => (
                              <tr key={i} className="hover:bg-muted/30">
                                <td className="px-3 py-2 font-medium">{group.sellerName}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {group.lineItems.map(l => `${l.title} ×${l.qty}`).join(", ")}
                                </td>
                                <td className="px-3 py-2 text-right">{formatKobo(group.subtotal)}</td>
                                <td className="px-3 py-2 text-right">{group.deliveryFee === 0 ? "Free" : formatKobo(group.deliveryFee)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{formatKobo(group.platformFee)}</td>
                                <td className="px-3 py-2 text-right text-green-700 font-semibold">{formatKobo(group.sellerPayout)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Proof thumbnail */}
                    {payment.proofUrl && (
                      <button
                        onClick={() => openProof(payment.proofUrl!)}
                        className="mt-1 flex items-center gap-2 group"
                        title="View payment proof"
                      >
                        <img
                          src={payment.proofUrl}
                          alt="Payment proof thumbnail"
                          className="h-14 w-20 object-cover rounded-lg border border-border group-hover:border-primary transition"
                        />
                        <span className="text-xs text-primary flex items-center gap-1 group-hover:underline">
                          <ExternalLink className="h-3 w-3" /> View full proof
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Confirm action */}
                  {!payment.adminConfirmed && (
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(payment)}
                      disabled={confirming === payment.id}
                      className="shrink-0 bg-green-600 hover:bg-green-700 text-white mt-0.5"
                    >
                      {confirming === payment.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      }
                      Confirm Received
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Proof lightbox */}
      <Dialog open={proofOpen} onOpenChange={setProofOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Payment Proof
            </DialogTitle>
          </DialogHeader>
          {proofImageUrl && (
            <div className="space-y-3">
              <img
                src={proofImageUrl}
                alt="Full payment proof"
                className="w-full rounded-xl border border-border object-contain max-h-[60vh]"
              />
              <a
                href={proofImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open original image
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
