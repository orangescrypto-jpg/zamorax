"use client"
// components/orders/ReturnGuarantee.tsx  (also used on listing pages)
// returnWindowDays + returnGuaranteeBadgeVisible from config/platform.
// RETURN_WINDOW_DAYS is no longer hardcoded — it reads from settings.

import { AdminService, serverTimestamp } from "@/src/services"
import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { RotateCcw, Shield, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

// ── 1. ReturnGuaranteeBadge ────────────────────────────────────────────────

export function ReturnGuaranteeBadge({ compact = false }: { compact?: boolean }) {
  const { settings } = usePlatformSettings()

  // ── Gate: admin hid the badge ─────────────────────────────────────────────
  if (!settings.returnGuaranteeBadgeVisible) return null

  const days = settings.returnWindowDays

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-full font-medium">
        <RotateCcw className="h-3.5 w-3.5" />
        {days}-Day Returns
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <RotateCcw className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-800">{days}-Day Return Guarantee</p>
          <p className="text-xs text-blue-600">Changed your mind? Return it within {days} days.</p>
        </div>
      </div>
      <ReturnPolicyAccordion />
    </div>
  )
}

function ReturnPolicyAccordion() {
  const [open, setOpen] = useState(false)
  const eligible = [
    "Item significantly different from listing description",
    "Item arrived damaged or not working",
    "Wrong item sent by seller",
    "Item is counterfeit or misrepresented",
  ]
  const notEligible = [
    "Buyer changed their mind (for used items)",
    "Item was accurately described but buyer dislikes it",
    "Damage caused by buyer after delivery",
  ]

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? "Hide" : "See"} return policy
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-xs">
          <div>
            <p className="font-semibold text-emerald-700 flex items-center gap-1 mb-1">
              <CheckCircle className="h-3.5 w-3.5" /> Eligible for return
            </p>
            <ul className="space-y-1 text-muted-foreground">
              {eligible.map((e, i) => <li key={i} className="flex gap-1.5"><span>•</span>{e}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-red-600 flex items-center gap-1 mb-1">
              <XCircle className="h-3.5 w-3.5" /> Not eligible
            </p>
            <ul className="space-y-1 text-muted-foreground">
              {notEligible.map((e, i) => <li key={i} className="flex gap-1.5"><span>•</span>{e}</li>)}
            </ul>
          </div>
          <p className="text-muted-foreground/70 italic">
            Return window starts when buyer confirms delivery. Escrow funds held until return resolved.
          </p>
        </div>
      )}
    </div>
  )
}

// ── 2. ReturnRequestForm ───────────────────────────────────────────────────

interface ReturnRequestFormProps {
  orderId: string
  listingId: string
  listingTitle: string
  sellerId: string
  deliveredAt: Date
}

export function ReturnRequestForm({ orderId, listingId, listingTitle, sellerId, deliveredAt }: ReturnRequestFormProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { settings } = usePlatformSettings()

  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const returnWindowDays = settings.returnWindowDays
  const daysSinceDelivery = Math.floor((Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24))
  const withinWindow = daysSinceDelivery <= returnWindowDays
  const daysLeft = returnWindowDays - daysSinceDelivery

  const reasons = [
    "Item not as described", "Item arrived damaged", "Wrong item received",
    "Item is counterfeit", "Item not working", "Other",
  ]

  const handleSubmit = async () => {
    if (!reason) { toast({ title: "Select a reason", variant: "destructive" }); return }
    if (details.length < 20) { toast({ title: "Please describe the issue (min 20 characters)", variant: "destructive" }); return }

    setSubmitting(true)
    try {
      await AdminService.addDoc("returnRequests", {
        orderId, listingId, listingTitle,
        buyerId: user?.uid, buyerName: user?.fullName || user?.email,
        sellerId, reason, details: details.trim(),
        status: "pending", createdAt: serverTimestamp(), deliveredAt, daysSinceDelivery,
        returnWindowDays, // store which window was active at time of request
      })
      await AdminService.addDoc("notifications", {
        userId: "admin", type: "system", title: "🔄 New Return Request",
        body: `Buyer requested a return for "${listingTitle}"`,
        link: `/admin/disputes`, isRead: false, createdAt: serverTimestamp(),
      })
      toast({ title: "Return request submitted", description: "Our team will review within 24 hours. Escrow funds are held.", variant: "success" })
      setOpen(false)
    } catch {
      toast({ title: "Error submitting return", variant: "destructive" })
    }
    setSubmitting(false)
  }

  if (!withinWindow) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 bg-muted/50 px-3 py-2 rounded-lg">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Return window has closed ({returnWindowDays}-day policy)
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-amber-800">
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="font-medium">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</span>
          <span className="text-amber-600">to request a return</span>
        </div>
        <Button size="sm" variant="outline" className="text-xs border-amber-300 text-amber-700 hover:bg-amber-100 h-7" onClick={() => setOpen(o => !o)}>
          {open ? "Cancel" : "Request Return"}
        </Button>
      </div>

      {open && (
        <div className="bg-card border rounded-xl p-4 space-y-4">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" /> Return Request
          </h3>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Reason for return</p>
            <div className="grid grid-cols-2 gap-2">
              {reasons.map(r => (
                <button
                  key={r} type="button" onClick={() => setReason(r)}
                  className={`text-xs text-left px-3 py-2 rounded-lg border transition-colors ${
                    reason === r ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Describe the issue</p>
            <textarea
              value={details} onChange={e => setDetails(e.target.value)}
              placeholder="Please describe clearly what's wrong with the item..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <Shield className="h-3.5 w-3.5 inline mr-1" />
            Escrow funds are held until this return is resolved by Zamorax.
          </div>
          <Button className="w-full bg-primary text-white" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Return Request"}
          </Button>
        </div>
      )}
    </div>
  )
}
