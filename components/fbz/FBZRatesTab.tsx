"use client"
// components/fbz/FBZRatesTab.tsx
// FBZ (Fulfilled by Zamorax) configuration — previously a section inside
// /admin/settings, now its own tab on /admin/fbz so warehouse/fee tuning
// lives next to pending/received/live/history shipment tabs.
//
// Loads + saves through the same /api/admin/settings blob endpoint as the
// main settings page, but only reads/writes FBZ-related keys — merging
// into whatever else is saved server-side.

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-fetch"
import { invalidateSettingsCache } from "@/src/services/platformSettings"
import { invalidatePlatformCache } from "@/hooks/usePlatformSettings"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { nigerianStates } from "@/constants/nigerianStates"
import { Loader2, Warehouse, MapPin, Phone, Clock, Save } from "lucide-react"
import {
  SectionCard, ToggleRow, KoboField, NumField, StrField, InfoBox,
} from "@/components/admin/SettingsFields"
import { FBZWarehouseLocations } from "@/components/admin/FBZWarehouseLocations"

// ─── Types (FBZ-only slice of the global Settings shape) ────────────────────

interface FBZSettings {
  fbzEnabled: boolean
  fbzPauseReason: string
  fbzWarehouseAddress: string
  fbzWarehousePhone: string
  fbzWarehouseHours: string
  fbzInboundFeeKobo: number
  fbzStorageFeePerDayKobo: number
  fbzPickPackFeeKobo: number
  fbzFulfillmentFeeKobo: number
  fbzMaxStockPerSeller: number
  fbzWarehouseCapacity: number
  fbzAutoRejectDamagedGoods: boolean
  fbzRequireInsurance: boolean
  fbzInsuranceRatePercent: number
  fbzDeliveryPartner: string
  fbzDeliveryDaysMin: number
  fbzDeliveryDaysMax: number
  fbzCoveredStates: string[]
}

const DEFAULTS: FBZSettings = {
  fbzEnabled: true,
  fbzPauseReason: "",
  fbzWarehouseAddress: "",
  fbzWarehousePhone: "",
  fbzWarehouseHours: "Mon–Sat, 9am–5pm",
  fbzInboundFeeKobo: 50000,
  fbzStorageFeePerDayKobo: 500,
  fbzPickPackFeeKobo: 40000,
  fbzFulfillmentFeeKobo: 1500,
  fbzMaxStockPerSeller: 500,
  fbzWarehouseCapacity: 10000,
  fbzAutoRejectDamagedGoods: true,
  fbzRequireInsurance: false,
  fbzInsuranceRatePercent: 0.5,
  fbzDeliveryPartner: "GIG Logistics",
  fbzDeliveryDaysMin: 1,
  fbzDeliveryDaysMax: 3,
  fbzCoveredStates: [],
}

// ─── FBZ Coverage Editor ──────────────────────────────────────────────────

function FBZCoverageEditor({
  states, onChange,
}: {
  states: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (state: string) =>
    onChange(
      states.includes(state)
        ? states.filter(s => s !== state)
        : [...states, state].sort()
    )

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> FBZ Delivery Coverage
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Select which states FBZ delivers to. Sellers and buyers will see this list when choosing FBZ as a shipping method.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {nigerianStates.map(state => {
          const active = states.includes(state)
          return (
            <button
              key={state}
              type="button"
              onClick={() => toggle(state)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                active
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-background border-border text-muted-foreground hover:border-amber-400"
              )}
            >
              {state}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {states.length === 0
          ? "No states selected — FBZ will show as unavailable to buyers and sellers."
          : `${states.length} state${states.length === 1 ? "" : "s"} selected.`}
      </p>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────

export function FBZRatesTab() {
  const { toast } = useToast()
  const [s, setS] = useState<FBZSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminFetch("/api/admin/settings")
      .then(r => r.json())
      .then(json => {
        if (json?.settings) {
          setS(prev => ({ ...prev, ...pickFbzKeys(json.settings) }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const bool = (key: keyof FBZSettings) => () => setS(p => ({ ...p, [key]: !p[key] } as FBZSettings))
  const str  = (key: keyof FBZSettings) => (v: string) => setS(p => ({ ...p, [key]: v }))
  const num  = (key: keyof FBZSettings) => (v: number) => setS(p => ({ ...p, [key]: v }))
  const kobo = (key: keyof FBZSettings) => (v: number) => setS(p => ({ ...p, [key]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Save failed (HTTP ${res.status})`)
      invalidateSettingsCache()
      invalidatePlatformCache()
      toast({ title: "✅ FBZ settings saved", description: "Changes applied instantly across the platform." })
    } catch (err: any) {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" })
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="space-y-5 pb-24">
      <SectionCard icon={Warehouse} title="FBZ — Fulfilled by Zamorax" accent>
        <ToggleRow label="FBZ enabled" desc="Toggle off to pause all new seller enrollments instantly" checked={s.fbzEnabled} onChange={bool("fbzEnabled")} />
        {!s.fbzEnabled && (
          <StrField label="Pause reason (shown to sellers)" value={s.fbzPauseReason} onChange={str("fbzPauseReason")} placeholder="e.g. We are at capacity. Check back in 2 weeks." />
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Warehouse Drop-off Details
          </p>
          <p className="text-xs text-muted-foreground">Shown to sellers after their shipment is approved.</p>
          <StrField label="Drop-off address" value={s.fbzWarehouseAddress} onChange={str("fbzWarehouseAddress")} placeholder="e.g. 14 Bode Thomas Street, Surulere, Lagos" />
          <div className="space-y-1">
            <Label className="text-sm font-medium flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact phone</Label>
            <Input value={s.fbzWarehousePhone} onChange={e => str("fbzWarehousePhone")(e.target.value)} placeholder="e.g. 0801 234 5678" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-medium flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Operating hours</Label>
            <Input value={s.fbzWarehouseHours} onChange={e => str("fbzWarehouseHours")(e.target.value)} placeholder="e.g. Mon–Sat, 9am–5pm" />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">FBZ Fees (charged to sellers)</p>
          <KoboField label="Inbound handling fee (per item)"  value={s.fbzInboundFeeKobo}       onChange={kobo("fbzInboundFeeKobo")} />
          <KoboField label="Storage fee per day (per unit)"   value={s.fbzStorageFeePerDayKobo} onChange={kobo("fbzStorageFeePerDayKobo")} />
          <KoboField label="Pick & pack fee per order"        value={s.fbzPickPackFeeKobo}      onChange={kobo("fbzPickPackFeeKobo")} />
          <KoboField label="Fulfillment fee per order"        value={s.fbzFulfillmentFeeKobo}   onChange={kobo("fbzFulfillmentFeeKobo")} />
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capacity & Rules</p>
          <NumField label="Max stock per seller" value={s.fbzMaxStockPerSeller} onChange={num("fbzMaxStockPerSeller")} suffix="units" />
          <NumField label="Total warehouse capacity" value={s.fbzWarehouseCapacity} onChange={num("fbzWarehouseCapacity")} suffix="units" />
          <ToggleRow label="Auto-reject damaged goods on intake" checked={s.fbzAutoRejectDamagedGoods} onChange={bool("fbzAutoRejectDamagedGoods")} />
          <ToggleRow label="Require seller insurance for FBZ items" checked={s.fbzRequireInsurance} onChange={bool("fbzRequireInsurance")} />
          {s.fbzRequireInsurance && (
            <NumField label="Insurance rate" value={s.fbzInsuranceRatePercent} onChange={num("fbzInsuranceRatePercent")} suffix="%" step={0.1} />
          )}
        </div>

        <Separator />

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Promise (shown to buyers)</p>
          <StrField label="Delivery partner name" value={s.fbzDeliveryPartner} onChange={str("fbzDeliveryPartner")} placeholder="e.g. GIG Logistics" />
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Min delivery days" value={s.fbzDeliveryDaysMin} onChange={num("fbzDeliveryDaysMin")} suffix="days" />
            <NumField label="Max delivery days" value={s.fbzDeliveryDaysMax} onChange={num("fbzDeliveryDaysMax")} suffix="days" />
          </div>
          <InfoBox color="green">
            Buyers see: <strong>"⚡ FBZ — Arrives in {s.fbzDeliveryDaysMin}–{s.fbzDeliveryDaysMax} days via {s.fbzDeliveryPartner || "courier"}"</strong>
          </InfoBox>
        </div>

        <Separator />

        <FBZCoverageEditor
          states={s.fbzCoveredStates}
          onChange={v => setS(p => ({ ...p, fbzCoveredStates: v }))}
        />

        <Separator />

        <FBZWarehouseLocations />
      </SectionCard>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save FBZ Settings
        </Button>
      </div>
    </div>
  )
}

// Pull only the FBZ-relevant keys out of the full settings blob so this
// tab's local state never carries unrelated settings fields around.
function pickFbzKeys(full: Record<string, any>): Partial<FBZSettings> {
  const keys: (keyof FBZSettings)[] = [
    "fbzEnabled", "fbzPauseReason", "fbzWarehouseAddress", "fbzWarehousePhone",
    "fbzWarehouseHours", "fbzInboundFeeKobo", "fbzStorageFeePerDayKobo",
    "fbzPickPackFeeKobo", "fbzFulfillmentFeeKobo", "fbzMaxStockPerSeller",
    "fbzWarehouseCapacity", "fbzAutoRejectDamagedGoods", "fbzRequireInsurance",
    "fbzInsuranceRatePercent", "fbzDeliveryPartner", "fbzDeliveryDaysMin",
    "fbzDeliveryDaysMax", "fbzCoveredStates",
  ]
  const picked: Partial<FBZSettings> = {}
  for (const k of keys) {
    if (full[k] !== undefined) (picked as any)[k] = full[k]
  }
  return picked
}
