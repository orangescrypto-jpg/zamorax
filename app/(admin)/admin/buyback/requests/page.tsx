"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminService } from "@/src/services/admin"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Phone, Mail, MapPin, Warehouse, Trash2, CheckCircle, XCircle, Banknote, PackageCheck } from "lucide-react"

interface BuybackRequest {
  id: string
  category_slug: string
  brand: string
  model: string
  storage_variant: string | null
  condition: string
  estimated_price: number | null
  final_price: number | null
  images: string
  known_issues: string | null
  fulfillment_method: string
  warehouse_id: string | null
  meetup_address: string | null
  contact_name: string | null
  contact_email: string
  contact_phone: string
  status: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  accepted:  "bg-emerald-100 text-emerald-800",
  rejected:  "bg-red-100 text-red-800",
  paid:      "bg-amber-100 text-amber-800",
  completed: "bg-gray-200 text-gray-800",
}

export default function AdminBuybackQueuePage() {
  const { toast } = useToast()
  const [requests, setRequests] = useState<BuybackRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("submitted")
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await AdminService.getCollection("buybackRequests") as unknown as BuybackRequest[]
      setRequests((data ?? []).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")))
    } catch {
      toast({ title: "Failed to load requests", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string, extra?: Record<string, unknown>) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/buyback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Failed")
      }
      toast({ title: `Marked as ${status}` })
      load()
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not update", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const hardDelete = async (id: string) => {
    if (!window.confirm("Permanently delete this request and its images? This cannot be undone.")) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/buyback/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "Deleted permanently" })
      load()
    } catch {
      toast({ title: "Could not delete", variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const filtered = requests.filter(r => filter === "all" || r.status === filter)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Sell for Cash — Requests</h1>
        <p className="text-sm text-muted-foreground">
          Inspection, payment, and negotiation all happen offline. Record the outcome here.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["submitted", "accepted", "rejected", "paid", "completed", "all"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${filter === s ? "bg-primary text-white border-primary" : "bg-muted/50 border-transparent"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            let images: string[] = []
            try { images = JSON.parse(r.images || "[]") } catch { images = [] }
            return (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {r.brand} {r.model} {r.storage_variant && `· ${r.storage_variant}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.condition.replace("_", " ")} · Estimated ₦{Number(r.estimated_price ?? 0).toLocaleString()}
                        {r.final_price != null && <> · Final ₦{Number(r.final_price).toLocaleString()}</>}
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                  </div>

                  {images.length > 0 && (
                    <div className="flex gap-2">
                      {images.slice(0, 4).map((img, i) => (
                        <img key={i} src={img} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                      ))}
                    </div>
                  )}

                  {r.known_issues && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                      {r.known_issues}
                    </p>
                  )}

                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {r.contact_phone}</span>
                    <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {r.contact_email}</span>
                    {r.fulfillment_method === "dropoff" ? (
                      <span className="flex items-center gap-1.5 sm:col-span-2"><Warehouse className="h-3.5 w-3.5" /> Drop-off at warehouse</span>
                    ) : (
                      <span className="flex items-center gap-1.5 sm:col-span-2"><MapPin className="h-3.5 w-3.5" /> Meet at: {r.meetup_address}</span>
                    )}
                  </div>

                  {r.status === "submitted" && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                      <Input
                        type="number"
                        placeholder="Final price (₦)"
                        className="w-40"
                        value={priceInputs[r.id] ?? ""}
                        onChange={(e) => setPriceInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => updateStatus(r.id, "accepted", { finalPrice: Number(priceInputs[r.id] || r.estimated_price || 0) })}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === r.id}
                        onClick={() => updateStatus(r.id, "rejected")}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" /> Reject
                      </Button>
                    </div>
                  )}

                  {r.status === "accepted" && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => updateStatus(r.id, "paid", { paymentMethod: "cash" })}
                      >
                        <Banknote className="h-4 w-4 mr-1.5" /> Mark Paid
                      </Button>
                    </div>
                  )}

                  {r.status === "paid" && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => updateStatus(r.id, "completed")}
                      >
                        <PackageCheck className="h-4 w-4 mr-1.5" /> Mark Completed
                      </Button>
                    </div>
                  )}

                  {(r.status === "completed" || r.status === "rejected") && (
                    <div className="flex justify-end pt-2 border-t">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === r.id}
                        onClick={() => hardDelete(r.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" /> Delete Permanently
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-10">No requests in this view.</p>
          )}
        </div>
      )}
    </div>
  )
}
