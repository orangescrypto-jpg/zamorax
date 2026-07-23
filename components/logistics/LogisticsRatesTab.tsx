"use client"
// components/logistics/LogisticsRatesTab.tsx
// Zamorax Logistics (ZamoraxLogic) rate configuration — previously a
// collapsed section inside /admin/settings, now its own tab on
// /admin/logistics so rate-tuning lives next to shipments/agents/ledger.
//
// Loads + saves through the same /api/admin/settings blob endpoint as the
// main settings page (settings are stored as one document), but only reads
// and writes the logistics-related keys — merging into whatever else is
// already saved server-side, so this page can't clobber unrelated settings.

import { useEffect, useState } from "react"
import { adminFetch } from "@/lib/admin-fetch"
import { invalidateSettingsCache } from "@/src/services/platformSettings"
import { invalidatePlatformCache } from "@/hooks/usePlatformSettings"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { nigerianStates } from "@/constants/nigerianStates"
import { Loader2, Truck, MapPin, Save, Plus, X } from "lucide-react"
import {
  SectionCard, ToggleRow, KoboField, NumField, InfoBox,
} from "@/components/admin/SettingsFields"

// ─── Types (logistics-only slice of the global Settings shape) ──────────────

interface LogisticsSettings {
  logisticsEnabled: boolean
  newZlaRegistrationOpen: boolean
  showWeightOnListing: boolean
  zlaCoveredStates: string[]
  zlaWeightThreshold: number
  zlaWeightPerKgKobo: number
  zlaZonePrices: Record<string, number>
  zlaRouteOverrides: Record<string, number>
  zlaDoorstepFee: number
  zlaFragileFee: number
  zlaParcelReceivedKobo: number
  zlaParcelDispatchedKobo: number
  zlaParcelDeliveredKobo: number
  zlaDoorstepBonusKobo: number
}

const DEFAULTS: LogisticsSettings = {
  logisticsEnabled: true,
  newZlaRegistrationOpen: true,
  showWeightOnListing: true,
  zlaCoveredStates: [],
  zlaWeightThreshold: 2,
  zlaWeightPerKgKobo: 100000,
  zlaZonePrices: {},
  zlaRouteOverrides: {},
  zlaDoorstepFee: 50000,
  zlaFragileFee: 30000,
  zlaParcelReceivedKobo: 0,
  zlaParcelDispatchedKobo: 0,
  zlaParcelDeliveredKobo: 0,
  zlaDoorstepBonusKobo: 0,
}

const ZONE_PAIRS: { key: string; label: string }[] = [
  { key: "same_state|same_state",       label: "Same State (Intrastate)" },
  { key: "southwest|southwest",         label: "Southwest ↔ Southwest" },
  { key: "southeast|southeast",         label: "Southeast ↔ Southeast" },
  { key: "southsouth|southsouth",       label: "South-South ↔ South-South" },
  { key: "northcentral|northcentral",   label: "North Central ↔ North Central" },
  { key: "northwest|northwest",         label: "Northwest ↔ Northwest" },
  { key: "northeast|northeast",         label: "Northeast ↔ Northeast" },
  { key: "southeast|southwest",         label: "Southwest ↔ Southeast" },
  { key: "southsouth|southwest",        label: "Southwest ↔ South-South" },
  { key: "northcentral|southwest",      label: "Southwest ↔ North Central" },
  { key: "northwest|southwest",         label: "Southwest ↔ Northwest" },
  { key: "northeast|southwest",         label: "Southwest ↔ Northeast" },
  { key: "southeast|southsouth",        label: "Southeast ↔ South-South" },
  { key: "northcentral|southeast",      label: "Southeast ↔ North Central" },
  { key: "northwest|southeast",         label: "Southeast ↔ Northwest" },
  { key: "northeast|southeast",         label: "Southeast ↔ Northeast" },
  { key: "northcentral|southsouth",     label: "South-South ↔ North Central" },
  { key: "northwest|southsouth",        label: "South-South ↔ Northwest" },
  { key: "northeast|southsouth",        label: "South-South ↔ Northeast" },
  { key: "northcentral|northwest",      label: "North Central ↔ Northwest" },
  { key: "northcentral|northeast",      label: "North Central ↔ Northeast" },
  { key: "northeast|northwest",         label: "Northwest ↔ Northeast" },
]

const POPULAR_ROUTES: { key: string; label: string }[] = [
  { key: "Lagos__Ibadan",         label: "Lagos → Ibadan" },
  { key: "Ibadan__Lagos",         label: "Ibadan → Lagos" },
  { key: "Lagos__Ogun",           label: "Lagos → Ogun" },
  { key: "Ogun__Lagos",           label: "Ogun → Lagos" },
  { key: "Lagos__Abuja",          label: "Lagos → Abuja" },
  { key: "Abuja__Lagos",          label: "Abuja → Lagos" },
  { key: "Abuja__Ibadan",         label: "Abuja → Ibadan" },
  { key: "Ibadan__Abuja",         label: "Ibadan → Abuja" },
  { key: "Lagos__Port Harcourt",  label: "Lagos → Port Harcourt" },
  { key: "Port Harcourt__Lagos",  label: "Port Harcourt → Lagos" },
  { key: "Lagos__Benin",          label: "Lagos → Benin City (Edo)" },
  { key: "Benin__Lagos",          label: "Benin City (Edo) → Lagos" },
  { key: "Abuja__Kano",           label: "Abuja → Kano" },
  { key: "Kano__Abuja",           label: "Kano → Abuja" },
  { key: "Kano__Lagos",           label: "Kano → Lagos" },
  { key: "Lagos__Kano",           label: "Lagos → Kano" },
]

const DEFAULT_ZONE_PRICES: Record<string, number> = {
  "same_state|same_state":       150000,
  "southwest|southwest":         200000,
  "southeast|southeast":         200000,
  "southsouth|southsouth":       200000,
  "northcentral|northcentral":   200000,
  "northwest|northwest":         200000,
  "northeast|northeast":         200000,
  "southeast|southwest":         350000,
  "southsouth|southwest":        350000,
  "northcentral|southwest":      300000,
  "northwest|southwest":         450000,
  "northeast|southwest":         500000,
  "southeast|southsouth":        300000,
  "northcentral|southeast":      350000,
  "northwest|southeast":         500000,
  "northeast|southeast":         450000,
  "northcentral|southsouth":     350000,
  "northwest|southsouth":        500000,
  "northeast|southsouth":        450000,
  "northcentral|northwest":      300000,
  "northcentral|northeast":      250000,
  "northeast|northwest":         300000,
}

const DEFAULT_ROUTE_OVERRIDES: Record<string, number> = {
  "Lagos__Ibadan":         80000,
  "Ibadan__Lagos":         80000,
  "Lagos__Ogun":           70000,
  "Ogun__Lagos":           70000,
  "Lagos__Abuja":          350000,
  "Abuja__Lagos":          350000,
  "Abuja__Ibadan":         280000,
  "Ibadan__Abuja":         280000,
  "Lagos__Port Harcourt":  400000,
  "Port Harcourt__Lagos":  400000,
  "Lagos__Benin":          250000,
  "Benin__Lagos":          250000,
  "Abuja__Kano":           250000,
  "Kano__Abuja":           250000,
  "Kano__Lagos":           450000,
  "Lagos__Kano":           450000,
}

// ─── ZLA Coverage Editor ──────────────────────────────────────────────────

function ZLACoverageEditor({
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
          <MapPin className="h-3.5 w-3.5" /> ZLA Covered States
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Select which states ZamoraxLogic delivers to. Buyers will only see the ZLA shipping option if both their state and the seller&apos;s state are selected here. Updates instantly — no agent hub sync required.
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
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {state}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {states.length === 0
          ? "No states selected — ZLA will be hidden from all buyers."
          : `${states.length} state${states.length === 1 ? "" : "s"} covered.`}
      </p>
    </div>
  )
}

// ─── Add Custom Route ─────────────────────────────────────────────────────

function AddRouteForm({ onAdd }: { onAdd: (from: string, to: string) => void }) {
  const [from, setFrom] = useState("")
  const [to,   setTo]   = useState("")

  const submit = () => {
    if (!from || !to || from === to) return
    onAdd(from, to)
    setFrom(""); setTo("")
  }

  return (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-dashed bg-muted/20">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">From</label>
        <select
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="h-9 text-xs border rounded-md px-2 bg-background min-w-[130px]"
        >
          <option value="">Select state</option>
          {nigerianStates.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">To</label>
        <select
          value={to}
          onChange={e => setTo(e.target.value)}
          className="h-9 text-xs border rounded-md px-2 bg-background min-w-[130px]"
        >
          <option value="">Select state</option>
          {nigerianStates.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={submit} disabled={!from || !to || from === to}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Route
      </Button>
    </div>
  )
}

// ─── Main Tab ─────────────────────────────────────────────────────────────

export function LogisticsRatesTab() {
  const { toast } = useToast()
  const [s, setS] = useState<LogisticsSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminFetch("/api/admin/settings")
      .then(r => r.json())
      .then(json => {
        if (json?.settings) {
          setS(prev => ({ ...prev, ...pickLogisticsKeys(json.settings) }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const bool  = (key: keyof LogisticsSettings) => () => setS(p => ({ ...p, [key]: !p[key] } as LogisticsSettings))
  const kobo  = (key: keyof LogisticsSettings) => (v: number) => setS(p => ({ ...p, [key]: v }))
  const num   = (key: keyof LogisticsSettings) => (v: number) => setS(p => ({ ...p, [key]: v }))

  // Preset routes + any custom ones the admin has added (present in saved
  // overrides but not in the preset list). Ordered presets-first so the
  // familiar list doesn't jump around as custom routes are added.
  const customKeys = Object.keys(s.zlaRouteOverrides ?? {}).filter(
    k => !POPULAR_ROUTES.some(r => r.key === k)
  )
  const allRouteKeys = [...POPULAR_ROUTES.map(r => r.key), ...customKeys]

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
      toast({ title: "✅ Logistics settings saved", description: "Changes applied instantly across the platform." })
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
      <SectionCard icon={Truck} title="Zamorax Logistics (ZamoraxLogic)" accent>
        <ToggleRow label="Enable ZamoraxLogic Delivery" desc="Show ZamoraxLogic delivery option at checkout" checked={s.logisticsEnabled} onChange={bool("logisticsEnabled")} />
        <ToggleRow label="Accept new ZLA applications" desc="Allow users to apply to become Zamorax Logistics Agents" checked={s.newZlaRegistrationOpen} onChange={bool("newZlaRegistrationOpen")} />
        <ToggleRow
          label="Show item weight on listing page"
          desc="Display item weight to buyers on the listing detail page"
          checked={s.showWeightOnListing}
          onChange={bool("showWeightOnListing")}
        />
        <ZLACoverageEditor
          states={s.zlaCoveredStates}
          onChange={v => setS(p => ({ ...p, zlaCoveredStates: v }))}
        />

        <Separator />

        {/* ── Zone Base Rates ── */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zone Base Rates</p>
            <p className="text-xs text-muted-foreground mt-1">
              Covers 0–{s.zlaWeightThreshold}kg. Route overrides below take priority.
              Keep these <strong>above</strong> ZamoraxLogic rates — the spread is your margin.
            </p>
          </div>
          <div className="space-y-2">
            {ZONE_PAIRS.map(({ key, label }) => (
              <KoboField
                key={key}
                label={label}
                value={(s.zlaZonePrices ?? {})[key] ?? DEFAULT_ZONE_PRICES[key] ?? 0}
                onChange={v => setS(p => ({ ...p, zlaZonePrices: { ...(p.zlaZonePrices ?? {}), [key]: v } }))}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* ── Route Overrides ── */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Route Overrides</p>
            <p className="text-xs text-muted-foreground mt-1">
              These override zone prices above. Pre-loaded with common routes — add any other State → State pair you need priced individually.
            </p>
          </div>
          <div className="space-y-2">
            {allRouteKeys.map(key => {
              const preset = POPULAR_ROUTES.find(r => r.key === key)
              const [from, to] = key.split("__")
              const label = preset?.label ?? `${from} → ${to}`
              const isCustom = !preset
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex-1">
                    <KoboField
                      label={label}
                      value={(s.zlaRouteOverrides ?? {})[key] ?? DEFAULT_ROUTE_OVERRIDES[key] ?? 0}
                      onChange={v => setS(p => ({ ...p, zlaRouteOverrides: { ...(p.zlaRouteOverrides ?? {}), [key]: v } }))}
                    />
                  </div>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => setS(p => {
                        const next = { ...(p.zlaRouteOverrides ?? {}) }
                        delete next[key]
                        return { ...p, zlaRouteOverrides: next }
                      })}
                      className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md border text-muted-foreground hover:text-red-600 hover:border-red-200"
                      title="Remove custom route"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <AddRouteForm
            onAdd={(from, to) => setS(p => ({
              ...p,
              zlaRouteOverrides: { ...(p.zlaRouteOverrides ?? {}), [`${from}__${to}`]: 0 },
            }))}
          />
        </div>

        <Separator />

        {/* ── Weight Surcharge ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Weight Surcharge</p>
          <NumField
            label="Weight threshold"
            desc="Items at or below this weight pay base rate only"
            value={s.zlaWeightThreshold}
            onChange={num("zlaWeightThreshold")}
            suffix="kg" min={0.5} step={0.5}
          />
          <KoboField
            label="Surcharge per extra kg"
            desc="Added for each kg above the threshold"
            value={s.zlaWeightPerKgKobo}
            onChange={kobo("zlaWeightPerKgKobo")}
          />
          <InfoBox color="blue">
            Example: 3kg item, threshold {s.zlaWeightThreshold}kg → base + {s.zlaWeightThreshold < 3 ? 3 - s.zlaWeightThreshold : 1}kg × ₦{(s.zlaWeightPerKgKobo / 100).toLocaleString()} surcharge
          </InfoBox>
        </div>

        <Separator />

        {/* ── Other Surcharges ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Other Surcharges</p>
          <KoboField label="Doorstep delivery fee" desc="Extra when buyer chooses doorstep" value={s.zlaDoorstepFee} onChange={kobo("zlaDoorstepFee")} />
          <KoboField label="Fragile handling fee"  desc="Extra when item is marked fragile" value={s.zlaFragileFee}  onChange={kobo("zlaFragileFee")} />
        </div>

        <Separator />

        {/* ── ZLA Agent Commissions ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ZLA Agent Commission Rates</p>
        <p className="text-xs text-muted-foreground">Credited to logistics agent wallet automatically on each action.</p>
        <div className="space-y-3">
          <KoboField label="Receive parcel from seller"  desc="Origin agent accepts drop-off"        value={s.zlaParcelReceivedKobo}   onChange={kobo("zlaParcelReceivedKobo")} />
          <KoboField label="Dispatch parcel"             desc="Agent sends to next agent"            value={s.zlaParcelDispatchedKobo} onChange={kobo("zlaParcelDispatchedKobo")} />
          <KoboField label="Final delivery to buyer"     desc="Destination agent completes delivery" value={s.zlaParcelDeliveredKobo}  onChange={kobo("zlaParcelDeliveredKobo")} />
          <KoboField label="Doorstep bonus"              desc="Extra for delivering to buyer door"   value={s.zlaDoorstepBonusKobo}    onChange={kobo("zlaDoorstepBonusKobo")} />
        </div>
      </SectionCard>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Logistics Settings
        </Button>
      </div>
    </div>
  )
}

// Pull only the logistics-relevant keys out of the full settings blob so
// this tab's local state never carries unrelated settings fields around.
function pickLogisticsKeys(full: Record<string, any>): Partial<LogisticsSettings> {
  const keys: (keyof LogisticsSettings)[] = [
    "logisticsEnabled", "newZlaRegistrationOpen", "showWeightOnListing",
    "zlaCoveredStates", "zlaWeightThreshold", "zlaWeightPerKgKobo",
    "zlaZonePrices", "zlaRouteOverrides", "zlaDoorstepFee", "zlaFragileFee",
    "zlaParcelReceivedKobo", "zlaParcelDispatchedKobo", "zlaParcelDeliveredKobo",
    "zlaDoorstepBonusKobo",
  ]
  const picked: Partial<LogisticsSettings> = {}
  for (const k of keys) {
    if (full[k] !== undefined) (picked as any)[k] = full[k]
  }
  return picked
}
