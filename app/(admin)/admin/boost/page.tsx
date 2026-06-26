"use client"
// app/(admin)/admin/boost/page.tsx
// Admin controls for the Ad Boost feature.
// Mirrors the pattern of app/(admin)/admin/fees/page.tsx.
//
// WHAT THIS PAGE CONTROLS:
//   Master on/off toggle   → adBoostEnabled in config/platformSettings
//   Pricing                → adBoostPrice*, adSpend*, margin* fields in config/platformSettings
//   Active campaigns table → read from adBoosts collection
//   Manual status control  → adminUpdateBoostStatus()
//   Revenue summary        → adminGetRevenueSummary()

import { useEffect, useState, useCallback } from "react"
import { useAuthStore } from "@/store/authStore"
import { AdminService, serverTimestamp, where } from "@/src/services"
import { getPlatformSettings } from "@/src/services/platformSettings"
import { invalidatePlatformCache } from "@/hooks/usePlatformSettings"
import {
  adminToggleAdBoost,
  adminUpdateBoostStatus,
  adminGetRevenueSummary,
  formatAdBoostPrice,
  type AdBoost,
  type AdBoostStatus,
  type AdBoostRevenueSummary,
} from "@/src/services/adBoostService"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  Loader2, Save, Megaphone, ToggleLeft, BarChart3, Info,
  TrendingUp, Wallet, AlertCircle, CheckCircle2, Clock, XCircle,
} from "lucide-react"

// ─── UI helpers ───────────────────────────────────────────────────────────────

function InfoBox({
  children, color = "blue",
}: {
  children: React.ReactNode; color?: "blue" | "amber" | "green" | "red"
}) {
  const cls = {
    blue:  "bg-blue-50 border-blue-100 text-blue-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
    red:   "bg-red-50 border-red-100 text-red-700",
  }[color]
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs flex gap-2 items-start ${cls}`}>
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: AdBoostStatus }) {
  const map: Record<AdBoostStatus, { label: string; className: string; Icon: React.ElementType }> = {
    pending:   { label: "Pending",   className: "bg-amber-100 text-amber-800",   Icon: Clock        },
    active:    { label: "Active",    className: "bg-blue-100 text-blue-800",     Icon: CheckCircle2 },
    running:   { label: "Running",   className: "bg-emerald-100 text-emerald-800", Icon: TrendingUp  },
    completed: { label: "Completed", className: "bg-gray-100 text-gray-600",     Icon: CheckCircle2 },
    cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700",       Icon: XCircle      },
  }
  const { label, className, Icon } = map[status] ?? map.pending
  return (
    <Badge className={`${className} flex items-center gap-1 text-xs font-medium`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}

// ─── Pricing settings interface (subset of PlatformSettings) ─────────────────

interface AdBoostPricingSettings {
  adBoostEnabled:               boolean
  adBoostPriceStandard:         number
  adBoostAdSpendStandard:       number
  adBoostMarginStandard:        number
  adBoostPriceCombined:         number
  adBoostAdSpendCombined:       number
  adBoostMarginCombined:        number
  adBoostMaxProductsPerCampaign: number
  adBoostCampaignDurationDays:  number
}

const PRICE_DEFAULTS: AdBoostPricingSettings = {
  adBoostEnabled:                false,
  adBoostPriceStandard:          1500000,
  adBoostAdSpendStandard:        800000,
  adBoostMarginStandard:         700000,
  adBoostPriceCombined:          1800000,
  adBoostAdSpendCombined:        1000000,
  adBoostMarginCombined:         800000,
  adBoostMaxProductsPerCampaign: 6,
  adBoostCampaignDurationDays:   7,
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminBoostPage() {
  const { toast } = useToast()

  const { user } = useAuthStore()
  const [pricing,  setPricing]  = useState<AdBoostPricingSettings>(PRICE_DEFAULTS)
  const [boosts,   setBoosts]   = useState<AdBoost[]>([])
  const [summary,  setSummary]  = useState<AdBoostRevenueSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toggling, setToggling] = useState(false)

  // Status filter for campaigns table
  const [statusFilter, setStatusFilter] = useState<AdBoostStatus | "all">("all")

  // Load platform settings + live boost subscription
  useEffect(() => {
    let unsub: (() => void) | undefined

    getPlatformSettings()
      .then(s => {
        setPricing({
          adBoostEnabled:                s.adBoostEnabled               ?? false,
          adBoostPriceStandard:          s.adBoostPriceStandard         ?? 1500000,
          adBoostAdSpendStandard:        s.adBoostAdSpendStandard       ?? 800000,
          adBoostMarginStandard:         s.adBoostMarginStandard        ?? 700000,
          adBoostPriceCombined:          s.adBoostPriceCombined         ?? 1800000,
          adBoostAdSpendCombined:        s.adBoostAdSpendCombined       ?? 1000000,
          adBoostMarginCombined:         s.adBoostMarginCombined        ?? 800000,
          adBoostMaxProductsPerCampaign: s.adBoostMaxProductsPerCampaign ?? 6,
          adBoostCampaignDurationDays:   s.adBoostCampaignDurationDays  ?? 7,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Real-time boosts
    unsub = AdminService.subscribeToCollection(
      "adBoosts",
      docs => setBoosts(docs as AdBoost[]),
    )

    // Revenue summary
    adminGetRevenueSummary()
      .then(r => { if (r.success && r.data) setSummary(r.data) })
      .catch(() => {})

    return () => unsub?.()
  }, [])

  // ── Toggle master switch ──────────────────────────────────────────────────

  const handleToggle = async () => {
    setToggling(true)
    const next = !pricing.adBoostEnabled
    const result = await adminToggleAdBoost(next)
    if (result.success) {
      setPricing(p => ({ ...p, adBoostEnabled: next }))
      invalidatePlatformCache()
      toast({
        title: next ? "✅ Ad Boost enabled" : "⏸ Ad Boost disabled",
        description: next
          ? "Sellers can now purchase Ad Boost campaigns."
          : "Ad Boost is hidden from all seller dashboards.",
      })
    } else {
      toast({ title: "Toggle failed", description: result.error, variant: "destructive" })
    }
    setToggling(false)
  }

  // ── Save pricing settings ─────────────────────────────────────────────────

  const savePricing = async () => {
    setSaving(true)
    try {
      // Merge Ad Boost pricing fields into the shared platform settings kv_store
      const currentRes = await fetch("/api/admin/settings")
      const currentJson = await currentRes.json()
      const current = currentJson?.settings ?? {}
      const merged = { ...current, ...pricing }
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        credentials: "include", // send sb-access-token/sb-uid httpOnly cookies
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          ...(user?.uid ? { "x-user-id": user.uid } : {}),
        },
        body: JSON.stringify(merged),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Save failed")
      }
      invalidatePlatformCache()
      toast({
        title: "✅ Pricing saved",
        description: "Ad Boost pricing is live for all sellers.",
      })
    } catch (e: any) {
      toast({ title: "Error saving pricing", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  // ── Update boost status ───────────────────────────────────────────────────

  const handleStatusChange = useCallback(async (
    boostId: string,
    newStatus: Extract<AdBoostStatus, "running" | "completed" | "cancelled">,
  ) => {
    const result = await adminUpdateBoostStatus(boostId, newStatus)
    if (result.success) {
      toast({ title: `Boost marked as ${newStatus}` })
    } else {
      toast({ title: "Failed to update status", description: result.error, variant: "destructive" })
    }
  }, [toast])

  // ── Derived: filtered boosts ──────────────────────────────────────────────

  const filteredBoosts = statusFilter === "all"
    ? boosts
    : boosts.filter(b => b.status === statusFilter)

  const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString("en-NG")}`

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-4xl space-y-8 pb-32">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Ad Boost Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage the external advertising campaign feature for sellers.
          </p>
        </div>
        <Button onClick={savePricing} disabled={saving} className="bg-primary text-white">
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Save className="h-4 w-4 mr-2" />Save Pricing</>
          }
        </Button>
      </div>

      {/* ── Revenue Summary ────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total Collected</p>
                <p className="text-lg font-bold">{naira(summary.totalCollected)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Ad Spend Allocated</p>
                <p className="text-lg font-bold">{naira(summary.totalAdSpend)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-xs text-muted-foreground">Platform Margin</p>
                <p className="text-lg font-bold">{naira(summary.totalMargin)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Master Toggle ──────────────────────────────────────────────────── */}
      <Card className={pricing.adBoostEnabled
        ? "border-emerald-300 ring-1 ring-emerald-200"
        : "border-muted"
      }>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ToggleLeft className="h-4 w-4 text-primary" />
            Master Toggle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoBox color={pricing.adBoostEnabled ? "green" : "amber"}>
            {pricing.adBoostEnabled
              ? "Ad Boost is LIVE. Sellers can purchase campaigns from their Boost Center."
              : "Ad Boost is OFF. All seller-facing Ad Boost UI shows a \"Coming Soon\" state."
            }
          </InfoBox>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Ad Boost Feature</p>
              <p className="text-xs text-muted-foreground">
                Turning this off hides Ad Boost from all sellers instantly. Existing active boosts are not affected.
              </p>
            </div>
            <Switch
              checked={pricing.adBoostEnabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Pricing Settings ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            Ad Boost Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          <InfoBox color="blue">
            Prices stored in kobo. Admin enters Naira — values are multiplied ×100.
            Ad Spend is what goes to Google/social. Margin is Zamorax revenue.
            Ad Spend + Margin should equal the plan price.
          </InfoBox>

          {/* Ad Boost plan */}
          <div className="space-y-4 pb-4 border-b border-border">
            <p className="text-sm font-semibold">Ad Boost (external only)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Price (₦)</Label>
                <Input
                  type="number" min={0} step={500}
                  value={pricing.adBoostPriceStandard / 100}
                  onChange={e => setPricing(p => ({
                    ...p, adBoostPriceStandard: Math.round(+e.target.value * 100),
                  }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ad Spend (₦)</Label>
                <Input
                  type="number" min={0} step={500}
                  value={pricing.adBoostAdSpendStandard / 100}
                  onChange={e => setPricing(p => ({
                    ...p, adBoostAdSpendStandard: Math.round(+e.target.value * 100),
                  }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margin (₦)</Label>
                <Input
                  type="number" min={0} step={500}
                  value={pricing.adBoostMarginStandard / 100}
                  onChange={e => setPricing(p => ({
                    ...p, adBoostMarginStandard: Math.round(+e.target.value * 100),
                  }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {pricing.adBoostAdSpendStandard + pricing.adBoostMarginStandard !== pricing.adBoostPriceStandard && (
              <InfoBox color="red">
                ⚠️ Ad Spend ({naira(pricing.adBoostAdSpendStandard)}) + Margin ({naira(pricing.adBoostMarginStandard)}) ≠ Price ({naira(pricing.adBoostPriceStandard)}). Please fix before saving.
              </InfoBox>
            )}
          </div>

          {/* Combined Boost plan */}
          <div className="space-y-4 pb-4 border-b border-border">
            <p className="text-sm font-semibold">Combined Boost (internal + external)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Price (₦)</Label>
                <Input
                  type="number" min={0} step={500}
                  value={pricing.adBoostPriceCombined / 100}
                  onChange={e => setPricing(p => ({
                    ...p, adBoostPriceCombined: Math.round(+e.target.value * 100),
                  }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ad Spend (₦)</Label>
                <Input
                  type="number" min={0} step={500}
                  value={pricing.adBoostAdSpendCombined / 100}
                  onChange={e => setPricing(p => ({
                    ...p, adBoostAdSpendCombined: Math.round(+e.target.value * 100),
                  }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margin (₦)</Label>
                <Input
                  type="number" min={0} step={500}
                  value={pricing.adBoostMarginCombined / 100}
                  onChange={e => setPricing(p => ({
                    ...p, adBoostMarginCombined: Math.round(+e.target.value * 100),
                  }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            {pricing.adBoostAdSpendCombined + pricing.adBoostMarginCombined !== pricing.adBoostPriceCombined && (
              <InfoBox color="red">
                ⚠️ Ad Spend ({naira(pricing.adBoostAdSpendCombined)}) + Margin ({naira(pricing.adBoostMarginCombined)}) ≠ Price ({naira(pricing.adBoostPriceCombined)}). Please fix before saving.
              </InfoBox>
            )}
          </div>

          {/* Campaign config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Max products per campaign</Label>
              <p className="text-xs text-muted-foreground">Products batched into one weekly external campaign</p>
              <Input
                type="number" min={1} max={20}
                value={pricing.adBoostMaxProductsPerCampaign}
                onChange={e => setPricing(p => ({
                  ...p, adBoostMaxProductsPerCampaign: +e.target.value,
                }))}
                className="h-9 text-sm max-w-[100px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Campaign duration (days)</Label>
              <p className="text-xs text-muted-foreground">How many days each campaign runs (default 7)</p>
              <Input
                type="number" min={1} max={30}
                value={pricing.adBoostCampaignDurationDays}
                onChange={e => setPricing(p => ({
                  ...p, adBoostCampaignDurationDays: +e.target.value,
                }))}
                className="h-9 text-sm max-w-[100px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Active Campaigns Table ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Campaigns ({filteredBoosts.length})
            </CardTitle>
            <Select
              value={statusFilter}
              onValueChange={v => setStatusFilter(v as AdBoostStatus | "all")}
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBoosts.length === 0 ? (
            <div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
              <Megaphone className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p className="text-sm">No campaigns found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBoosts.map(b => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 border rounded-lg px-4 py-3 bg-muted/20"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.productTitle || b.productId}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {b.planType} · Week {b.weekNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {b.platforms?.join(", ")}
                      </span>
                      <span className="text-xs font-medium text-primary">
                        {naira(b.amountPaid ?? 0)}
                      </span>
                    </div>
                  </div>

                  <StatusBadge status={b.status} />

                  {/* Manual status controls — only for actionable statuses */}
                  {(b.status === "pending" || b.status === "active") && (
                    <Select
                      onValueChange={v => handleStatusChange(
                        b.id,
                        v as Extract<AdBoostStatus, "running" | "completed" | "cancelled">,
                      )}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs shrink-0">
                        <SelectValue placeholder="Move to…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="running">Mark Running</SelectItem>
                        <SelectItem value="completed">Mark Completed</SelectItem>
                        <SelectItem value="cancelled">Cancel</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Save */}
      <div className="sticky bottom-4 flex justify-end pb-4">
        <Button
          onClick={savePricing}
          disabled={saving}
          size="lg"
          className="bg-primary text-white shadow-lg min-w-44"
        >
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
            : <><Save className="h-4 w-4 mr-2" />Save Ad Boost Settings</>
          }
        </Button>
      </div>
    </div>
  )
}
