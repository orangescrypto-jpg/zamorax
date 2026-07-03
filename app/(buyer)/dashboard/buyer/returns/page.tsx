"use client"
// app/(buyer)/dashboard/buyer/returns/page.tsx
// FIX: the sidebar has always linked to /dashboard/buyer/returns, but this
// route never existed -> 404. "Returns" and "Disputes" both flow through
// the same `disputes` table (DisputesService.getDisputesByUser), so this
// page reuses that instead of introducing a separate returnRequests table
// that isn't backed by any D1 schema.

import { DisputesService } from "@/src/services/disputes"
import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RotateCcw, ArrowRight, RefreshCw, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow, parseISO } from "date-fns"
import type { Dispute } from "@/src/types"

const statusColors: Record<string, string> = {
  open:      "bg-amber-100 text-amber-800",
  pending:   "bg-amber-100 text-amber-800",
  resolved:  "bg-green-100 text-green-800",
  refunded:  "bg-green-100 text-green-800",
  released:  "bg-blue-100 text-blue-800",
  escalated: "bg-purple-100 text-purple-800",
  closed:    "bg-gray-100 text-gray-600",
}

const reasonLabels: Record<string, string> = {
  item_not_received:    "Item not received",
  item_not_as_described:"Item not as described",
  wrong_item_sent:       "Wrong item sent",
  damaged_item:          "Item arrived damaged",
  seller_unresponsive:   "Seller unresponsive",
  other:                 "Other",
}

function timeAgo(val: unknown): string {
  if (!val) return "Just now"
  try {
    const d = typeof val === "string" ? parseISO(val) : new Date(val as any)
    return formatDistanceToNow(d, { addSuffix: true })
  } catch { return "Just now" }
}

export default function BuyerReturnsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [returns, setReturns] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!user?.uid) return
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await DisputesService.getDisputesByUser(user.uid)
      // Returns page only shows requests the buyer themselves raised —
      // disputes a seller opened against this buyer belong on a different view.
      setReturns(data.items.filter(d => d.raisedBy === "buyer"))
    } catch (e: any) {
      toast({ title: "Could not load returns", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.uid])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <main className="container max-w-lg py-6 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <RotateCcw className="h-5 w-5" /> Returns
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {returns.length} return{returns.length !== 1 ? "s" : ""} requested
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5"
          disabled={refreshing}
          onClick={() => load(true)}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {returns.length === 0 && (
        <div className="border border-dashed rounded-xl py-16 text-center text-muted-foreground space-y-3">
          <RotateCcw className="h-10 w-10 mx-auto opacity-20" />
          <p>No return requests yet.</p>
          <p className="text-xs px-6">
            You can request a return from an order's detail page within the return window.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/buyer/orders">View Orders</Link>
          </Button>
        </div>
      )}

      {returns.map(r => (
        <Card key={r.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  Order #{r.orderId.slice(-6).toUpperCase()}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</p>
              </div>
              <Badge className={`shrink-0 capitalize ${statusColors[r.status] || "bg-gray-100"}`}>
                {r.status}
              </Badge>
            </div>

            <div className="text-xs bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-muted-foreground">Reason</p>
              <p className="font-medium">{reasonLabels[r.reason] ?? r.reason}</p>
            </div>

            {r.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
            )}

            {r.verdict && (
              <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                Resolution: {r.verdict.replace(/_/g, " ")}
              </div>
            )}

            <Link
              href={`/dashboard/buyer/orders/${r.orderId}`}
              className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium p-2.5 border border-primary/30 bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors"
            >
              View Order <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ))}
    </main>
  )
}
