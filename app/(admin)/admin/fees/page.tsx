"use client"
// app/(admin)/admin/fees/page.tsx
// Dedicated fee settings page — split from the massive admin/settings/page.tsx.
// Saves to Firestore: config/fees (read by useFeeSettings across all components).
//
// WHAT THIS PAGE CONTROLS:
//   Seller fees  → commission (sale + rental), arbitration pool %, withdrawal fee
//   Buyer fee    → optional convenience/processing fee at checkout

import { adminFetch } from "@/lib/admin-fetch"
//
// ARBITRATION NOTE:
//   The "insurance rate" is rebranded here as "Arbitration Pool" — it funds the
//   dispute resolution process managed by AdminService. It is held separately
//   from platform revenue and disbursed to the winning party on dispute close.
//   This naming is more honest and builds seller trust.
//
// FORMAT:
//   commissionSale/commissionRental stored as whole number: 4 = 4%
//   insuranceRate stored as decimal: 0.5 = 0.5%  (small enough that whole number
//   feels misleading to admin, so we keep decimal but show as % in the UI)
//   withdrawalFee in KOBO (admin enters naira, we multiply × 100)
//   buyerConvenienceFee in KOBO (same)

import { useEffect, useState } from "react"
import { invalidateFeeCache } from "@/hooks/useFeeSettings"
import {
  DEFAULT_FEE_SETTINGS,
  type FeeSettings,
  calculateFees,
} from "@/src/services/feeSettings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import {
  Loader2, Save, Percent, ShieldCheck, Wallet, Info, AlertCircle,
} from "lucide-react"

// ─── Reusable UI helpers ──────────────────────────────────────────────────────

function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string; desc?: string; checked: boolean; onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

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

// ─── Live Preview helper ──────────────────────────────────────────────────────

function LivePreview({ fees }: { fees: FeeSettings }) {
  const EXAMPLE_KOBO = 5000000  // ₦50,000 example order
  const b = calculateFees(EXAMPLE_KOBO, "sale", fees)

  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Live Preview — ₦50,000 sale
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Buyer pays</span>
          <span className="font-semibold text-primary">{formatPrice(b.buyerTotalKobo)}</span>
        </div>
        {b.buyerConvenienceKobo > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground pl-3">↳ {fees.buyerFeeLabel}</span>
            <span className="text-muted-foreground">+{formatPrice(b.buyerConvenienceKobo)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-destructive text-xs">
          <span>Commission deducted from seller ({b.commissionPct.toFixed(1)}%)</span>
          <span>-{formatPrice(b.commissionKobo)}</span>
        </div>
        <div className="flex justify-between text-destructive text-xs">
          <span>Arbitration pool ({b.insurancePct.toFixed(1)}%)</span>
          <span>-{formatPrice(b.insuranceKobo)}</span>
        </div>
        <div className="flex justify-between text-destructive text-xs">
          <span>Withdrawal fee (on payout)</span>
          <span>-{formatPrice(b.withdrawalFeeKobo)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-bold">
          <span>Seller receives</span>
          <span className="text-accent">{formatPrice(b.sellerPayoutKobo)}</span>
        </div>
        <div className="flex justify-between font-bold text-xs">
          <span className="text-muted-foreground">Platform revenue (commission only)</span>
          <span>{formatPrice(b.commissionKobo)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminFeesPage() {
  const { toast } = useToast()
  const [fees,    setFees]    = useState<FeeSettings>(DEFAULT_FEE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    adminFetch("/api/admin/fees")
      .then(res => res.json())
      .then(data => {
        if (data?.fees) setFees(prev => ({ ...prev, ...(data.fees as Partial<FeeSettings>) }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await adminFetch("/api/admin/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fees),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to save")

      // Bust hook cache so all components pick up new values on next render
      invalidateFeeCache()
      toast({
        title:       "✅ Fee settings saved",
        description: "All components now read the updated rates.",
      })
    } catch (err: any) {
      toast({ title: "Error saving fee settings", description: err?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container py-8 max-w-2xl space-y-6 pb-32">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Fee Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All fees apply instantly across FeeBreakdown, FeeCalculator, and checkout.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-white">
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Save className="h-4 w-4 mr-2" />Save Fees</>
          }
        </Button>
      </div>

      {/* ── Live Preview ───────────────────────────────────────────────────── */}
      <LivePreview fees={fees} />

      {/* ── Seller Fees ────────────────────────────────────────────────────── */}
      <Card className="border-primary/30 ring-1 ring-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-primary" />
            Seller Fees
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          <InfoBox color="blue">
            These fees are deducted from the seller's payout — buyers see no deduction.
            Commission and arbitration pool are taken at transaction time; withdrawal fee at payout.
          </InfoBox>

          {/* Sale commission */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Sale Commission</Label>
            <p className="text-xs text-muted-foreground">
              % of item price deducted from seller payout on each sale
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={fees.commissionSale}
                onChange={e => setFees(p => ({ ...p, commissionSale: Number(e.target.value) }))}
                step={0.5}
                min={0}
                max={30}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {/* Rental commission */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Rental Commission</Label>
            <p className="text-xs text-muted-foreground">
              % deducted on rental transactions (higher risk justifies higher rate)
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={fees.commissionRental}
                onChange={e => setFees(p => ({ ...p, commissionRental: Number(e.target.value) }))}
                step={0.5}
                min={0}
                max={30}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <Separator />

          {/* Arbitration pool */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Arbitration Pool Rate</Label>
            <p className="text-xs text-muted-foreground">
              % held in the dispute fund managed by AdminService. Released to the winning
              party when a dispute closes. This is separate from platform revenue.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={fees.insuranceRate}
                onChange={e => setFees(p => ({ ...p, insuranceRate: Number(e.target.value) }))}
                step={0.1}
                min={0}
                max={5}
                className="max-w-[120px]"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <InfoBox color="amber">
              Keep this between 0.3–1%. Too high and sellers notice. The pool only pays out on
              disputed orders — non-disputed orders recycle the held amount back to platform
              reserve after the inspection window closes.
            </InfoBox>
          </div>

          <Separator />

          {/* Withdrawal fee */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Withdrawal Fee (Fixed)</Label>
            <p className="text-xs text-muted-foreground">
              Flat fee deducted each time a seller requests a payout. Covers bank transfer cost.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">₦</span>
              <Input
                type="number"
                value={fees.withdrawalFee / 100}
                onChange={e => setFees(p => ({
                  ...p,
                  withdrawalFee: Math.round(parseFloat(e.target.value || "0") * 100),
                }))}
                step={50}
                min={0}
                className="max-w-[120px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Stored as {fees.withdrawalFee} kobo = ₦{(fees.withdrawalFee / 100).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Buyer Convenience Fee ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-primary" />
            Buyer Convenience Fee
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          <InfoBox color="blue">
            A small flat fee added to the buyer's checkout total. Frame it as a "processing fee"
            not a platform fee — buyers accept this more easily. Keep it under ₦200.
            Leave disabled at launch and enable once you have transaction volume.
          </InfoBox>

          <ToggleRow
            label="Enable buyer convenience fee"
            desc="When off, buyers pay exactly the item price — no extra charges"
            checked={fees.buyerFeeEnabled}
            onChange={() => setFees(p => ({ ...p, buyerFeeEnabled: !p.buyerFeeEnabled }))}
          />

          {fees.buyerFeeEnabled && (
            <>
              <div className="space-y-1">
                <Label className="text-sm font-medium">Fee Amount</Label>
                <p className="text-xs text-muted-foreground">
                  Flat fee added to every order total (in Naira)
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">₦</span>
                  <Input
                    type="number"
                    value={fees.buyerConvenienceFee / 100}
                    onChange={e => setFees(p => ({
                      ...p,
                      buyerConvenienceFee: Math.round(parseFloat(e.target.value || "0") * 100),
                    }))}
                    step={50}
                    min={0}
                    max={500}
                    className="max-w-[120px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-medium">Label shown at checkout</Label>
                <p className="text-xs text-muted-foreground">
                  Text shown next to the fee line in BuyNowModal order summary
                </p>
                <Input
                  value={fees.buyerFeeLabel}
                  onChange={e => setFees(p => ({ ...p, buyerFeeLabel: e.target.value }))}
                  placeholder="e.g. Processing fee"
                  className="max-w-xs"
                />
              </div>

              <InfoBox color="green">
                Buyers will see: <strong>"{fees.buyerFeeLabel}: +₦{(fees.buyerConvenienceFee / 100).toLocaleString()}"</strong> in the order summary before paying.
              </InfoBox>

              {fees.buyerConvenienceFee > 20000 && (
                <InfoBox color="amber">
                  ⚠️ Fee is above ₦200. Buyers may notice and abandon checkout. Consider keeping it at ₦100–₦150.
                </InfoBox>
              )}
            </>
          )}

          {!fees.buyerFeeEnabled && (
            <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Buyer fee is off. Buyers pay item price only. No convenience fee will appear at checkout.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Arbitration Fund Transparency note ───────────────────────────── */}
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            About the Arbitration Pool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The arbitration pool ({fees.insuranceRate}% per order) is held in a separate
            Firestore ledger under <code>config/arbitration</code>. It is not part of platform
            revenue. When a buyer or seller wins a dispute, AdminService credits the arbitration
            fund to the winning party's wallet and debits the pool. Sellers can see a transparency
            breakdown in their payout history. This separation builds trust and protects Zamorax
            from liability on disputed funds.
          </p>
        </CardContent>
      </Card>

      {/* Sticky Save */}
      <div className="sticky bottom-4 flex justify-end pb-4">
        <Button
          onClick={save}
          disabled={saving}
          size="lg"
          className="bg-primary text-white shadow-lg min-w-40"
        >
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
            : <><Save className="h-4 w-4 mr-2" />Save Fee Settings</>
          }
        </Button>
      </div>
    </div>
  )
}
