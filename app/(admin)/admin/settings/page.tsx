"use client"

import {AdminService, serverTimestamp} from "@/src/services"
// app/(admin)/admin/settings/page.tsx
// COMPLETE: All original sections preserved + FBZ expanded with warehouse details
// Saves to Firestore: config/platform (single doc, instant apply)

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import {
  Loader2, Save, Percent, ShieldCheck, CreditCard, Zap,
  Wallet, Bell, Bot, MessageSquare, Package2, Warehouse,
  Truck, Globe, AlertTriangle, Gift, MapPin, Phone, Clock,
  ChevronDown, ChevronUp,
} from "lucide-react"
import { FBZWarehouseLocations } from "@/components/admin/FBZWarehouseLocations"
import { BankDetailsSettings } from "@/components/admin/BankDetailsSettings"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Settings {
  // Commission
  commissionSale: number
  commissionRental: number
  insuranceRate: number
  withdrawalFee: number
  // Plans
  planStarterPrice: number
  planProPrice: number
  // Boosts
  boostStandard: number
  boostPremium: number
  boostCategoryTop: number
  hubVerificationFee: number
  // Payout
  minPayoutAmount: number
  instantPayoutEnabled: boolean
  payoutProcessingHours: number
  // Dispute auto-resolution
  autoResolveEnabled: boolean
  autoResolveItemNotReceivedDays: number
  autoResolveNoTrackingDays: number
  autoResolveSellerNoResponseHours: number
  autoResolveInspectionWindowDays: number
  autoResolveLowValueThreshold: number
  // FBZ — original fields
  fbzEnabled: boolean
  fbzStorageFeePerDayKobo: number
  fbzFulfillmentFeeKobo: number
  fbzMaxStockPerSeller: number
  fbzWarehouseCapacity: number
  fbzAutoRejectDamagedGoods: boolean
  fbzRequireInsurance: boolean
  fbzInsuranceRatePercent: number
  // FBZ — new warehouse contact fields
  fbzWarehouseAddress: string
  fbzWarehousePhone: string
  fbzWarehouseHours: string
  fbzInboundFeeKobo: number
  fbzPickPackFeeKobo: number
  fbzDeliveryPartner: string
  fbzDeliveryDaysMin: number
  fbzDeliveryDaysMax: number
  fbzPauseReason: string
  // Search alerts
  maxSearchAlertsPerUser: number
  searchAlertCooldownHours: number
  // Buyer badges
  badgeVerifiedBuyerOrders: number
  badgeTrustedBuyerOrders: number
  badgePowerBuyerOrders: number
  // Q&A
  qnaEnabled: boolean
  qnaSellerResponseSLAHours: number
  // Push notifications
  pushNotifsEnabled: boolean
  pushPriceDropAlertsEnabled: boolean
  // Bundles
  bundlesEnabled: boolean
  maxBundleItems: number
  maxBundleDiscountPercent: number
  // Platform features
  maintenanceMode: boolean
  maintenanceMessage: string
  newUserRegistrationEnabled: boolean
  flashDealsEnabled: boolean
  groupBuyEnabled: boolean
  rentalsEnabled: boolean
  // Referral rewards
  referralSignupRewardKobo: number
  referralOrderRewardKobo: number
  // Logistics
  logisticsEnabled: boolean
  newZlaRegistrationOpen: boolean
  doorstepSurchargeKobo: number
  feeIntrastate: number
  feeSWtoSW: number
  feeSWtoSE: number
  feeSWtoSS: number
  feeSWtoNC: number
  feeSWtoNW: number
  feeSWtoNE: number
  feeSEtoSE: number
  feeSEtoSS: number
  feeSEtoNC: number
  feeNCtoNC: number
  feeNWtoNW: number
  feeNEtoNE: number
  feeFarCrossCountry: number
  zlaParcelReceivedKobo: number
  zlaParcelDispatchedKobo: number
  zlaParcelDeliveredKobo: number
  zlaDoorstepBonusKobo: number
}

const DEFAULTS: Settings = {
  commissionSale: 0.015,
  commissionRental: 0.04,
  insuranceRate: 0.005,
  withdrawalFee: 100,
  planStarterPrice: 1500,
  planProPrice: 3500,
  boostStandard: 500,
  boostPremium: 1500,
  boostCategoryTop: 3000,
  hubVerificationFee: 1000,
  minPayoutAmount: 100000,
  instantPayoutEnabled: true,
  payoutProcessingHours: 24,
  autoResolveEnabled: true,
  autoResolveItemNotReceivedDays: 14,
  autoResolveNoTrackingDays: 7,
  autoResolveSellerNoResponseHours: 48,
  autoResolveInspectionWindowDays: 3,
  autoResolveLowValueThreshold: 500000,
  fbzEnabled: true,
  fbzStorageFeePerDayKobo: 500,
  fbzFulfillmentFeeKobo: 1500,
  fbzMaxStockPerSeller: 500,
  fbzWarehouseCapacity: 10000,
  fbzAutoRejectDamagedGoods: true,
  fbzRequireInsurance: false,
  fbzInsuranceRatePercent: 0.5,
  fbzWarehouseAddress: "",
  fbzWarehousePhone: "",
  fbzWarehouseHours: "Mon–Sat, 9am–5pm",
  fbzInboundFeeKobo: 50000,
  fbzPickPackFeeKobo: 40000,
  fbzDeliveryPartner: "GIG Logistics",
  fbzDeliveryDaysMin: 1,
  fbzDeliveryDaysMax: 3,
  fbzPauseReason: "",
  maxSearchAlertsPerUser: 10,
  searchAlertCooldownHours: 6,
  badgeVerifiedBuyerOrders: 5,
  badgeTrustedBuyerOrders: 20,
  badgePowerBuyerOrders: 50,
  qnaEnabled: true,
  qnaSellerResponseSLAHours: 24,
  pushNotifsEnabled: true,
  pushPriceDropAlertsEnabled: true,
  bundlesEnabled: true,
  maxBundleItems: 5,
  maxBundleDiscountPercent: 30,
  maintenanceMode: false,
  maintenanceMessage: "",
  newUserRegistrationEnabled: true,
  flashDealsEnabled: true,
  groupBuyEnabled: true,
  rentalsEnabled: true,
  referralSignupRewardKobo: 50000,
  referralOrderRewardKobo: 200000,
  logisticsEnabled: true,
  newZlaRegistrationOpen: true,
  doorstepSurchargeKobo: 50000,
  feeIntrastate: 150000,
  feeSWtoSW: 200000,
  feeSWtoSE: 350000,
  feeSWtoSS: 350000,
  feeSWtoNC: 300000,
  feeSWtoNW: 450000,
  feeSWtoNE: 500000,
  feeSEtoSE: 200000,
  feeSEtoSS: 300000,
  feeSEtoNC: 350000,
  feeNCtoNC: 200000,
  feeNWtoNW: 200000,
  feeNEtoNE: 200000,
  feeFarCrossCountry: 500000,
  zlaParcelReceivedKobo: 20000,
  zlaParcelDispatchedKobo: 15000,
  zlaParcelDeliveredKobo: 30000,
  zlaDoorstepBonusKobo: 10000,
}

type NumKey  = { [K in keyof Settings]: Settings[K] extends number  ? K : never }[keyof Settings]
type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

// ─── Reusable field components ───────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, children, accent, defaultOpen = true,
}: {
  icon: React.ElementType; title: string; children: React.ReactNode
  accent?: boolean; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className={accent ? "border-primary/30 ring-1 ring-primary/10" : ""}>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          <span className="flex-1">{title}</span>
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="space-y-4 pt-0">{children}</CardContent>}
    </Card>
  )
}

function NumField({ label, desc, value, onChange, prefix, suffix, step, min, max }: {
  label: string; desc?: string; value: number
  onChange: (v: number) => void
  prefix?: string; suffix?: string; step?: number; min?: number; max?: number
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      <div className="flex items-center gap-2">
        {prefix && <span className="text-sm text-muted-foreground shrink-0">{prefix}</span>}
        <Input
          type="number" value={value}
          onChange={e => onChange(Number(e.target.value))}
          step={step ?? 1} min={min ?? 0} max={max}
          className="max-w-xs"
        />
        {suffix && <span className="text-sm text-muted-foreground shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

function KoboField({ label, desc, value, onChange }: {
  label: string; desc?: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-muted-foreground">₦</span>
        <Input
          type="number"
          value={value / 100}
          onChange={e => onChange(Math.round(parseFloat(e.target.value) * 100))}
          step={100} min={0}
          className="w-28 text-right"
        />
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: {
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

function StrField({ label, desc, value, onChange, placeholder }: {
  label: string; desc?: string; value: string
  onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [s, setS] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    AdminService.getDoc("config", "platform")
      .then(docs => { if (snap.exists()) setS(prev => ({ ...prev, ...snap.data() })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const num  = (key: NumKey)  => (v: number)  => setS(p => ({ ...p, [key]: v }))
  const bool = (key: BoolKey) => ()           => setS(p => ({ ...p, [key]: !p[key] }))
  const str  = (key: keyof Settings) => (v: string) => setS(p => ({ ...p, [key]: v }))
  const kobo = (key: NumKey)  => (v: number)  => setS(p => ({ ...p, [key]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await AdminService.setDoc("config", "platform", { ...s, updatedAt: serverTimestamp() }, { merge: true })
      toast({ title: "✅ Settings saved", description: "All changes applied instantly across the platform." })
    } catch {
      toast({ title: "Error saving settings", variant: "destructive" })
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-2xl space-y-5 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Platform Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All changes apply instantly — no code deployment needed.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Save All</>}
        </Button>
      </div>

      {/* Commission & Fees */}
      <SectionCard icon={Percent} title="Commission & Fees">
        <NumField label="Sale commission" desc="% of order value" value={s.commissionSale * 100} onChange={v => setS(p => ({ ...p, commissionSale: v / 100 }))} suffix="%" step={0.1} />
        <NumField label="Rental commission" value={s.commissionRental * 100} onChange={v => setS(p => ({ ...p, commissionRental: v / 100 }))} suffix="%" step={0.1} />
        <NumField label="Insurance rate" value={s.insuranceRate * 100} onChange={v => setS(p => ({ ...p, insuranceRate: v / 100 }))} suffix="%" step={0.1} />
        <NumField label="Withdrawal fee" value={s.withdrawalFee} onChange={num("withdrawalFee")} prefix="₦" />
      </SectionCard>

      {/* Platform Bank Account — manual payment provider */}
      <BankDetailsSettings />

      {/* Referral Rewards */}
      <SectionCard icon={Gift} title="Referral Agent Rewards" defaultOpen={false}>
        <p className="text-xs text-muted-foreground">Rates update instantly. Agents see live rates on their dashboard.</p>
        <KoboField label="Signup reward" desc="Paid when a referred user signs up" value={s.referralSignupRewardKobo} onChange={kobo("referralSignupRewardKobo")} />
        <KoboField label="First order reward" desc="Paid when a referred user places their first order" value={s.referralOrderRewardKobo} onChange={kobo("referralOrderRewardKobo")} />
      </SectionCard>

      {/* FBZ — Fulfilled by Zamorax ── EXPANDED with warehouse details */}
      <Card className="border-primary/30 ring-1 ring-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Warehouse className="h-4 w-4 text-primary" />
            FBZ — Fulfilled by Zamorax
            <span className="ml-auto text-[10px] font-bold bg-gradient-to-r from-primary to-emerald-500 text-white px-2 py-0.5 rounded-full">
              WAREHOUSE
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ToggleRow label="FBZ enabled" desc="Toggle off to pause all new seller enrollments instantly" checked={s.fbzEnabled} onChange={bool("fbzEnabled")} />
          {!s.fbzEnabled && (
            <StrField label="Pause reason (shown to sellers)" value={s.fbzPauseReason} onChange={str("fbzPauseReason")} placeholder="e.g. We are at capacity. Check back in 2 weeks." />
          )}

          <Separator />

          {/* Warehouse contact details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Warehouse Drop-off Details
            </p>
            <p className="text-xs text-muted-foreground">Shown to sellers after their shipment is approved.</p>
            <StrField
              label="Drop-off address"
              value={s.fbzWarehouseAddress}
              onChange={str("fbzWarehouseAddress")}
              placeholder="e.g. 14 Bode Thomas Street, Surulere, Lagos"
            />
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Contact phone
              </Label>
              <Input
                value={s.fbzWarehousePhone}
                onChange={e => str("fbzWarehousePhone")(e.target.value)}
                placeholder="e.g. 0801 234 5678"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Operating hours
              </Label>
              <Input
                value={s.fbzWarehouseHours}
                onChange={e => str("fbzWarehouseHours")(e.target.value)}
                placeholder="e.g. Mon–Sat, 9am–5pm"
              />
            </div>
          </div>

          <Separator />

          {/* FBZ Fees */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">FBZ Fees (charged to sellers)</p>
            <KoboField label="Inbound handling fee (per item)"  value={s.fbzInboundFeeKobo}    onChange={kobo("fbzInboundFeeKobo")} />
            <KoboField label="Storage fee per day (per unit)"   value={s.fbzStorageFeePerDayKobo} onChange={kobo("fbzStorageFeePerDayKobo")} />
            <KoboField label="Pick & pack fee per order"        value={s.fbzPickPackFeeKobo}    onChange={kobo("fbzPickPackFeeKobo")} />
            <KoboField label="Fulfillment fee per order"        value={s.fbzFulfillmentFeeKobo} onChange={kobo("fbzFulfillmentFeeKobo")} />
          </div>

          <Separator />

          {/* FBZ capacity & rules */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capacity & Rules</p>
            <NumField label="Max stock per seller" value={s.fbzMaxStockPerSeller} onChange={num("fbzMaxStockPerSeller")} suffix="units" />
            <NumField label="Total warehouse capacity" value={s.fbzWarehouseCapacity} onChange={num("fbzWarehouseCapacity")} suffix="units" />
            <ToggleRow label="Auto-reject damaged goods on intake" checked={s.fbzAutoRejectDamagedGoods} onChange={bool("fbzAutoRejectDamagedGoods")} />
            <ToggleRow label="Require seller insurance for FBZ items" checked={s.fbzRequireInsurance} onChange={bool("fbzRequireInsurance")} />
          </div>

          <Separator />

          {/* Delivery promise */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Promise (shown to buyers)</p>
            <StrField
              label="Delivery partner name"
              value={s.fbzDeliveryPartner}
              onChange={str("fbzDeliveryPartner")}
              placeholder="e.g. GIG Logistics"
            />
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Min delivery days" value={s.fbzDeliveryDaysMin} onChange={num("fbzDeliveryDaysMin")} suffix="days" />
              <NumField label="Max delivery days" value={s.fbzDeliveryDaysMax} onChange={num("fbzDeliveryDaysMax")} suffix="days" />
            </div>
            <div className="bg-emerald-50 rounded-lg px-3 py-2 text-xs text-emerald-700">
              Buyers see: <strong>"⚡ FBZ — Arrives in {s.fbzDeliveryDaysMin}–{s.fbzDeliveryDaysMax} days via {s.fbzDeliveryPartner || "courier"}"</strong>
            </div>
          </div>

          <Separator />

          {/* Multiple warehouse drop-off locations */}
          <FBZWarehouseLocations />

        </CardContent>
      </Card>

      {/* Zamorax Logistics */}
      <SectionCard icon={Truck} title="Zamorax Logistics" defaultOpen={false}>
        <ToggleRow label="Enable Zamorax Logistics" desc="Show logistics delivery option at checkout" checked={s.logisticsEnabled} onChange={bool("logisticsEnabled")} />
        <ToggleRow label="Accept new ZLA applications" desc="Allow users to apply to become Zamorax Logistics Agents" checked={s.newZlaRegistrationOpen} onChange={bool("newZlaRegistrationOpen")} />
        <KoboField label="Doorstep surcharge" desc="Extra fee when buyer chooses doorstep delivery" value={s.doorstepSurchargeKobo} onChange={kobo("doorstepSurchargeKobo")} />
        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Zone Fees</p>
        <p className="text-xs text-muted-foreground">Charged to buyer at checkout based on seller → buyer state zones.</p>
        <div className="space-y-3">
          <KoboField label="Same state (intrastate)"               value={s.feeIntrastate} onChange={kobo("feeIntrastate")} />
          <KoboField label="Southwest ↔ Southwest"                 value={s.feeSWtoSW}     onChange={kobo("feeSWtoSW")} />
          <KoboField label="Southwest ↔ Southeast"                 value={s.feeSWtoSE}     onChange={kobo("feeSWtoSE")} />
          <KoboField label="Southwest ↔ South-South"               value={s.feeSWtoSS}     onChange={kobo("feeSWtoSS")} />
          <KoboField label="Southwest ↔ North Central"             value={s.feeSWtoNC}     onChange={kobo("feeSWtoNC")} />
          <KoboField label="Southwest ↔ Northwest"                 value={s.feeSWtoNW}     onChange={kobo("feeSWtoNW")} />
          <KoboField label="Southwest ↔ Northeast"                 value={s.feeSWtoNE}     onChange={kobo("feeSWtoNE")} />
          <KoboField label="Southeast ↔ Southeast"                 value={s.feeSEtoSE}     onChange={kobo("feeSEtoSE")} />
          <KoboField label="Southeast ↔ South-South"               value={s.feeSEtoSS}     onChange={kobo("feeSEtoSS")} />
          <KoboField label="Southeast ↔ North Central"             value={s.feeSEtoNC}     onChange={kobo("feeSEtoNC")} />
          <KoboField label="North Central ↔ North Central"         value={s.feeNCtoNC}     onChange={kobo("feeNCtoNC")} />
          <KoboField label="Northwest ↔ Northwest"                 value={s.feeNWtoNW}     onChange={kobo("feeNWtoNW")} />
          <KoboField label="Northeast ↔ Northeast"                 value={s.feeNEtoNE}     onChange={kobo("feeNEtoNE")} />
          <KoboField label="Far cross-country (e.g. Lagos→Borno)"  value={s.feeFarCrossCountry} onChange={kobo("feeFarCrossCountry")} />
        </div>
        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ZLA Commission Rates</p>
        <p className="text-xs text-muted-foreground">Credited to logistics agent wallet automatically on each action.</p>
        <div className="space-y-3">
          <KoboField label="Receive parcel from seller"     desc="Origin agent accepts drop-off"       value={s.zlaParcelReceivedKobo}   onChange={kobo("zlaParcelReceivedKobo")} />
          <KoboField label="Dispatch parcel"                desc="Agent sends to next agent"           value={s.zlaParcelDispatchedKobo} onChange={kobo("zlaParcelDispatchedKobo")} />
          <KoboField label="Final delivery to buyer"        desc="Destination agent completes delivery" value={s.zlaParcelDeliveredKobo}  onChange={kobo("zlaParcelDeliveredKobo")} />
          <KoboField label="Doorstep bonus"                 desc="Extra for delivering to buyer door"  value={s.zlaDoorstepBonusKobo}    onChange={kobo("zlaDoorstepBonusKobo")} />
        </div>
      </SectionCard>

      {/* Plans */}
      <SectionCard icon={CreditCard} title="Subscription Plans" defaultOpen={false}>
        <NumField label="Starter plan" value={s.planStarterPrice} onChange={num("planStarterPrice")} prefix="₦/mo" />
        <NumField label="Pro plan" value={s.planProPrice} onChange={num("planProPrice")} prefix="₦/mo" />
      </SectionCard>

      {/* Boosts */}
      <SectionCard icon={Zap} title="Boosts & Verification" defaultOpen={false}>
        <NumField label="Standard boost" value={s.boostStandard} onChange={num("boostStandard")} prefix="₦" />
        <NumField label="Premium boost" value={s.boostPremium} onChange={num("boostPremium")} prefix="₦" />
        <NumField label="Category top boost" value={s.boostCategoryTop} onChange={num("boostCategoryTop")} prefix="₦" />
        <NumField label="Hub verification fee" value={s.hubVerificationFee} onChange={num("hubVerificationFee")} prefix="₦" />
      </SectionCard>

      {/* Payout */}
      <SectionCard icon={Wallet} title="Payout Settings" defaultOpen={false}>
        <NumField label="Minimum payout (kobo)" value={s.minPayoutAmount} onChange={num("minPayoutAmount")} />
        <ToggleRow label="Instant payout" desc="Verified sellers get same-day payouts" checked={s.instantPayoutEnabled} onChange={bool("instantPayoutEnabled")} />
        <NumField label="Manual payout SLA" value={s.payoutProcessingHours} onChange={num("payoutProcessingHours")} suffix="hrs" />
      </SectionCard>

      {/* Dispute Auto-Resolution */}
      <SectionCard icon={Bot} title="Dispute Auto-Resolution" defaultOpen={false}>
        <ToggleRow label="Enable auto-resolution" checked={s.autoResolveEnabled} onChange={bool("autoResolveEnabled")} />
        <Separator />
        <NumField label="Item not received — refund after" value={s.autoResolveItemNotReceivedDays} onChange={num("autoResolveItemNotReceivedDays")} suffix="days" />
        <NumField label="No tracking — refund after" value={s.autoResolveNoTrackingDays} onChange={num("autoResolveNoTrackingDays")} suffix="days" />
        <NumField label="Seller no-response — escalate after" value={s.autoResolveSellerNoResponseHours} onChange={num("autoResolveSellerNoResponseHours")} suffix="hrs" />
        <NumField label="Inspection window" value={s.autoResolveInspectionWindowDays} onChange={num("autoResolveInspectionWindowDays")} suffix="days" />
        <NumField label="Low-value threshold" value={s.autoResolveLowValueThreshold} onChange={num("autoResolveLowValueThreshold")} suffix="kobo" />
      </SectionCard>

      {/* Search Alerts */}
      <SectionCard icon={Bell} title="Search Alerts" defaultOpen={false}>
        <NumField label="Max alerts per user" value={s.maxSearchAlertsPerUser} onChange={num("maxSearchAlertsPerUser")} suffix="alerts" />
        <NumField label="Alert cooldown" value={s.searchAlertCooldownHours} onChange={num("searchAlertCooldownHours")} suffix="hrs" />
      </SectionCard>

      {/* Buyer Badges */}
      <SectionCard icon={ShieldCheck} title="Buyer Badge Thresholds" defaultOpen={false}>
        <NumField label="Verified Buyer" value={s.badgeVerifiedBuyerOrders} onChange={num("badgeVerifiedBuyerOrders")} suffix="orders" />
        <NumField label="Trusted Buyer" value={s.badgeTrustedBuyerOrders} onChange={num("badgeTrustedBuyerOrders")} suffix="orders" />
        <NumField label="Power Buyer" value={s.badgePowerBuyerOrders} onChange={num("badgePowerBuyerOrders")} suffix="orders" />
      </SectionCard>

      {/* Q&A */}
      <SectionCard icon={MessageSquare} title="Listing Q&A" defaultOpen={false}>
        <ToggleRow label="Q&A enabled" checked={s.qnaEnabled} onChange={bool("qnaEnabled")} />
        <NumField label="Seller response SLA" value={s.qnaSellerResponseSLAHours} onChange={num("qnaSellerResponseSLAHours")} suffix="hrs" />
      </SectionCard>

      {/* Push Notifications */}
      <SectionCard icon={Bell} title="Push Notifications" defaultOpen={false}>
        <ToggleRow label="Platform push notifications" checked={s.pushNotifsEnabled} onChange={bool("pushNotifsEnabled")} />
        <ToggleRow label="Price drop alerts" checked={s.pushPriceDropAlertsEnabled} onChange={bool("pushPriceDropAlertsEnabled")} />
      </SectionCard>

      {/* Bundles */}
      <SectionCard icon={Package2} title="Bundle Deals" defaultOpen={false}>
        <ToggleRow label="Bundle deals enabled" checked={s.bundlesEnabled} onChange={bool("bundlesEnabled")} />
        <NumField label="Max items per bundle" value={s.maxBundleItems} onChange={num("maxBundleItems")} suffix="items" />
        <NumField label="Max bundle discount" value={s.maxBundleDiscountPercent} onChange={num("maxBundleDiscountPercent")} suffix="%" />
      </SectionCard>

      {/* Platform Features */}
      <SectionCard icon={Globe} title="Platform Features" defaultOpen={false}>
        <ToggleRow label="Flash Deals" checked={s.flashDealsEnabled} onChange={bool("flashDealsEnabled")} />
        <ToggleRow label="Group Buy" checked={s.groupBuyEnabled} onChange={bool("groupBuyEnabled")} />
        <ToggleRow label="Rentals" checked={s.rentalsEnabled} onChange={bool("rentalsEnabled")} />
        <ToggleRow label="New user registration" checked={s.newUserRegistrationEnabled} onChange={bool("newUserRegistrationEnabled")} />
      </SectionCard>

      {/* Maintenance */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" /> Maintenance Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Enable maintenance mode"
            desc="Takes the marketplace offline for non-admin users"
            checked={s.maintenanceMode}
            onChange={bool("maintenanceMode")}
          />
          {s.maintenanceMode && (
            <div className="space-y-1.5">
              <Label className="text-sm">Maintenance message</Label>
              <Input
                placeholder="We're performing scheduled maintenance. Back shortly!"
                value={s.maintenanceMessage}
                onChange={e => str("maintenanceMessage")(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Save */}
      <div className="sticky bottom-4 flex justify-end pb-4">
        <Button onClick={save} disabled={saving} size="lg" className="bg-primary text-white shadow-lg min-w-40">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving…" : "Save All Settings"}
        </Button>
      </div>
    </div>
  )
}
