"use client"
import type { Order } from "@/src/types"
// app/(buyer)/dashboard/buyer/orders/page.tsx
// Server-side cursor pagination — 15 orders per page, cheapest Firestore reads

import { useEffect, useState, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { where, orderBy, OffersService } from "@/src/services"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import Image from "next/image"
import {
  Loader2, ShoppingBag, Clock, CheckCircle,
  Truck, Package, ShieldAlert, ChevronRight, RefreshCw,
} from "lucide-react"

const PAGE_SIZE = 15

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700",   icon: <Clock className="h-3.5 w-3.5" /> },
  paid:      { label: "Paid",      color: "bg-blue-100 text-blue-700",     icon: <CheckCircle className="h-3.5 w-3.5" /> },
  shipped:   { label: "Shipped",   color: "bg-purple-100 text-purple-700", icon: <Truck className="h-3.5 w-3.5" /> },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-700", icon: <Package className="h-3.5 w-3.5" /> },
  completed: { label: "Completed", color: "bg-green-100 text-green-700",   icon: <CheckCircle className="h-3.5 w-3.5" /> },
  refunded:  { label: "Refunded",  color: "bg-gray-100 text-gray-600",     icon: <CheckCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600",       icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  disputed:  { label: "Disputed",  color: "bg-red-100 text-red-600",       icon: <ShieldAlert className="h-3.5 w-3.5" /> },
}

const TABS = [
  { key: "all",       label: "All",       filter: () => true },
  { key: "active",    label: "Active",    filter: (o: Order) => ["pending","paid","shipped","delivered"].includes(o.status) },
  { key: "completed", label: "Completed", filter: (o: Order) => o.status === "completed" },
  { key: "disputed",  label: "Disputed",  filter: (o: Order) => o.status === "disputed" },
]

function OrderCard({ order }: { order: Order }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  return (
    <Link href={`/dashboard/buyer/orders/${order.id}`}>
      <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
            {order.itemImage
              ? <Image src={order.itemImage} alt={order.itemTitle || ""} fill className="object-cover" />
              : <Package className="h-6 w-6 m-5 text-muted-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{order.itemTitle || "Order"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              #{order.id.slice(-6).toUpperCase()} · {order.createdAt
                ? formatDistanceToNow(typeof order.createdAt === "string" ? new Date(order.createdAt) : (order.createdAt as any).toDate(), { addSuffix: true })
                : ""}
            </p>
            <p className="text-sm font-bold text-primary mt-1">{formatPrice(order.totalAmount || 0)}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge className={`flex items-center gap-1 text-[10px] px-2 py-0.5 border-0 ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function BuyerOrdersPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const { items: orders, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection({
      collectionPath: "orders",
      constraints: user?.uid
        ? [where("buyerId", "==", user.uid), orderBy("createdAt", "desc")]
        : [],
      pageSize: PAGE_SIZE,
    })

  useEffect(() => { if (user?.uid) reload() }, [user?.uid])

  // Safety net for online (Paystack/Flutterwave) checkouts: BuyNowModal no
  // longer marks an accepted offer "used" before redirecting to pay, since
  // that burned the offer even if the buyer abandoned/failed payment. There
  // is currently no payment webhook for these providers, so this list —
  // which the checkout redirects back to — is where we detect that the
  // order actually reached escrow_held (real payment confirmed) and mark
  // the offer used at that point instead. Guarded by a ref so each order
  // is only processed once per session even as this page polls/reloads.
  const processedOfferOrders = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.uid) return
    for (const order of orders as any[]) {
      const isOfferOrder = !!(order.is_offer_order ?? order.isOfferOrder)
      const offerListingId = order.listingId ?? order.listing_id
      const escrowHeld = (order.escrowStatus ?? order.escrow_status) === "held" || order.status === "escrow_held"
      if (isOfferOrder && escrowHeld && offerListingId && !processedOfferOrders.current.has(order.id)) {
        processedOfferOrders.current.add(order.id)
        OffersService.markOfferUsed(offerListingId, user.uid).catch(() => {
          // Non-fatal — worst case the offer can be reused once more,
          // which is safer than a false "already used" block on a real order.
          processedOfferOrders.current.delete(order.id)
        })
      }
    }
  }, [orders, user?.uid])

  // Auto-activate Paystack/Flutterwave orders on return from checkout. Both
  // BuyNowModal and CartCheckoutModal redirect back to this list page after
  // online checkout, but nothing previously verified the payment -- orders
  // sat at "pending" until an admin manually confirmed them. This
  // re-verifies directly with the relevant gateway and flips the order to
  // escrow_held automatically, same as manual admin confirmation. Guarded
  // by a ref so each order is only attempted once per session even as this
  // page polls/reloads.
  const processedPaystackOrders = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.uid) return
    for (const order of orders as any[]) {
      const provider = order.paymentProvider ?? order.payment_provider
      const reference = order.paymentReference ?? order.payment_reference
      const activateEndpoint =
        provider === "paystack"    ? "/api/orders/activate-paystack"
        : provider === "flutterwave" ? "/api/orders/activate-flutterwave"
        : null
      if (
        activateEndpoint &&
        order.status === "pending" &&
        reference &&
        !processedPaystackOrders.current.has(order.id)
      ) {
        processedPaystackOrders.current.add(order.id)
        fetch(activateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, reference }),
        })
          .then((res) => { if (res.ok) reload() })
          .catch(() => {
            // Non-fatal -- payment may not have cleared yet; a later reload
            // of this page (or admin fallback) will retry/confirm it.
            processedPaystackOrders.current.delete(order.id)
          })
      }
    }
  }, [orders, user?.uid])

  // Reconcile cart checkouts on return from Paystack. CartCheckoutModal no
  // longer pre-creates order rows before redirecting to Paystack (an order
  // must never exist for a payment that hasn't succeeded), so nothing has
  // turned the payment into orders yet by the time the buyer lands back
  // here. create-pending-orders now verifies the reference with Paystack
  // itself before writing anything, so it's safe to just call it — it's a
  // no-op if the orders already exist or the payment never went through.
  const processedCartRefs = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.uid) return
    let reference: string | null = null
    try {
      const params = new URLSearchParams(window.location.search)
      const urlRef = params.get("reference") || params.get("trxref")
      // Only treat this as a cart checkout if we actually stashed a
      // pending_cart_ref_ key for this exact reference — otherwise this
      // effect has no way to tell a cart reference apart from a Buy Now
      // one (both just show up as ?reference=... on return from Paystack),
      // and would wrongly call create-pending-orders for a Buy Now order,
      // which always fails with "No pending payment for: ...".
      if (urlRef && sessionStorage.getItem(`pending_cart_ref_${urlRef}`)) {
        reference = urlRef
      } else {
        // Fall back to the last cart reference stashed before redirect —
        // only if there's no reference in the URL at all (defensive; the
        // normal case above already covers Paystack's real return URL).
        if (!urlRef) {
          const keys = Object.keys(sessionStorage).filter((k) => k.startsWith("pending_cart_ref_"))
          reference = keys.length ? sessionStorage.getItem(keys[keys.length - 1]) : null
        }
      }
    } catch { /* sessionStorage/URL unavailable — skip reconciliation */ }
    if (!reference || processedCartRefs.current.has(reference)) return
    processedCartRefs.current.add(reference)
    fetch("/api/cart/create-pending-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    })
      .then(async (res) => {
        if (res.ok) {
          try { sessionStorage.removeItem(`pending_cart_ref_${reference}`) } catch {}
          reload()
          return
        }
        const data = await res.json().catch(() => ({}))
        processedCartRefs.current.delete(reference!)
        toast({
          title: "Couldn't finish creating your order",
          description: data.error || "Your payment may have gone through — contact support with your reference if this persists.",
          variant: "destructive",
        })
        console.error("create-pending-orders failed:", reference, data.error)
      })
      .catch((err) => {
        processedCartRefs.current.delete(reference!)
        toast({
          title: "Couldn't finish creating your order",
          description: "Network error — your payment may have gone through. Refresh this page to retry.",
          variant: "destructive",
        })
        console.error("create-pending-orders network error:", reference, err)
      })
  }, [user?.uid])

  // Reconcile single-item Buy Now checkouts on return from Paystack.
  // BuyNowModal stashes the order draft under pending_order_<reference> in
  // sessionStorage before redirecting, instead of creating the order up
  // front — so nothing has turned the payment into an order yet by the
  // time the buyer lands back here. This looks up that draft and asks
  // create-verified-paystack to verify the payment and create the order.
  const processedBuyNowRefs = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.uid) return
    let reference: string | null = null
    let draftRaw: string | null = null
    try {
      const params = new URLSearchParams(window.location.search)
      reference = params.get("reference") || params.get("trxref")
      if (reference) {
        draftRaw = sessionStorage.getItem(`pending_order_${reference}`)
      }
      if (!draftRaw) {
        // Fall back to the most recent stashed draft if the URL didn't
        // carry a reference param for some reason.
        const keys = Object.keys(sessionStorage).filter((k) => k.startsWith("pending_order_"))
        if (keys.length) {
          const lastKey = keys[keys.length - 1]
          reference = lastKey.replace("pending_order_", "")
          draftRaw = sessionStorage.getItem(lastKey)
        }
      }
    } catch { /* sessionStorage/URL unavailable — skip reconciliation */ }
    if (!reference || !draftRaw || processedBuyNowRefs.current.has(reference)) return
    processedBuyNowRefs.current.add(reference)
    let orderDraft: unknown
    try { orderDraft = JSON.parse(draftRaw) } catch { return }

    // The draft doesn't carry which gateway was used (BuyNowModal's
    // sessionStorage key is provider-agnostic), so try Paystack first,
    // then fall back to Flutterwave. Both endpoints independently 402
    // "Payment not verified" if the reference isn't actually theirs, so
    // this is safe either order.
    const tryEndpoint = (path: string) =>
      fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, orderDraft }),
      })

    tryEndpoint("/api/orders/create-verified-paystack")
      .then(async (res) => {
        if (res.ok) {
          try { sessionStorage.removeItem(`pending_order_${reference}`) } catch {}
          reload()
          return
        }
        // Paystack didn't recognize this reference — it may be a
        // Flutterwave payment instead. Try that before giving up.
        const flwRes = await tryEndpoint("/api/orders/create-verified-flutterwave")
        if (flwRes.ok) {
          try { sessionStorage.removeItem(`pending_order_${reference}`) } catch {}
          reload()
          return
        }
        // Don't silently drop this — a payment succeeded but the order
        // failed to create is exactly the kind of failure a buyer needs
        // to see (and can report), not one that should just vanish.
        const data = await flwRes.json().catch(() => ({}))
        processedBuyNowRefs.current.delete(reference!)
        toast({
          title: "Couldn't finish creating your order",
          description: data.error || "Your payment may have gone through — contact support with your reference if this persists.",
          variant: "destructive",
        })
        console.error("create-verified-paystack/flutterwave failed:", reference, data.error)
      })
      .catch((err) => {
        processedBuyNowRefs.current.delete(reference!)
        toast({
          title: "Couldn't finish creating your order",
          description: "Network error — your payment may have gone through. Refresh this page to retry.",
          variant: "destructive",
        })
        console.error("create-verified-paystack network error:", reference, err)
      })
  }, [user?.uid])

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-2xl py-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> My Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{total} orders loaded</p>
        </div>
        <Button variant="outline" size="icon" onClick={reload} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">No orders yet.</p>
          <Button asChild className="bg-primary text-white">
            <Link href="/">Start Shopping</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            {TABS.map(t => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
                <span className="ml-1 text-[10px] opacity-70">
                  ({orders.filter(t.filter).length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(t => (
            <TabsContent key={t.key} value={t.key} className="space-y-3">
              {orders.filter(t.filter).map(o => <OrderCard key={o.id} order={o} />)}
              {orders.filter(t.filter).length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-xl">
                  No {t.label.toLowerCase()} orders.
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        total={total}
        label={`Load Next ${PAGE_SIZE} Orders`}
      />
    </div>
  )
}
