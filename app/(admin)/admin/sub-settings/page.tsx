// app/(admin)/admin/sub-settings/page.tsx
"use client"
// Sub Settings — a lightweight, separate config doc for anything added
// AFTER the main /admin/settings page grew too large. Saves to its own
// key (kv_store: "sub_settings") via /api/admin/sub-settings, completely
// independent of the main config/platform doc.
//
// TO ADD A NEW SETTING HERE IN THE FUTURE:
//   1. Add the field + default in src/services/subSettings.ts
//   2. Add a control for it below (reuse ToggleRow/NumField/StrField)
//   That's it — the API route and hook need no changes.

import { adminFetch } from "@/lib/admin-fetch"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Save, ArrowLeft, ListChecks, Settings2, Sparkles, ShoppingCart, Truck, CalendarClock, Bell, LayoutGrid } from "lucide-react"
import {
  DEFAULT_SUB_SETTINGS,
  type SubSettings,
} from "@/src/services/subSettings"
import { invalidateSubSettingsCache } from "@/hooks/useSubSettings"
import { invalidateSettingsCache, type PlatformSettings } from "@/src/services/platformSettings"
import { HOMEPAGE_CATEGORIES, MORE_CATEGORIES } from "@/constants/categories"

// Layaway lives on the main PlatformSettings object (config/platform),
// not the sub_settings doc -- it needs to sit alongside the rest of the
// platform's fee/commission logic. Fetched and saved separately from the
// SubSettings state below, via the existing /api/admin/settings route.
type LayawaySlice = Pick<
  PlatformSettings,
  "layawayEnabled" | "layawayMinDepositPercent" | "layawayMaxDepositPercent"
  | "layawayMinDepositFlatKobo" | "layawayMaxDepositFlatKobo"
  | "layawayMaxDays" | "layawayDefaultForfeitPercent"
>
const LAYAWAY_DEFAULTS: LayawaySlice = {
  layawayEnabled: false,
  layawayMinDepositPercent: 20,
  layawayMaxDepositPercent: 80,
  layawayMinDepositFlatKobo: 100000,
  layawayMaxDepositFlatKobo: 100000000,
  layawayMaxDays: 90,
  layawayDefaultForfeitPercent: 10,
}

// ── Reusable UI helpers (same look as the main settings page) ───────────────

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

function NumField({ label, desc, value, onChange, min, max, step }: {
  label: string; desc?: string; value: number
  onChange: (v: number) => void
  min?: number; max?: number; step?: number
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      <Input
        type="number" value={value}
        onChange={e => onChange(Number(e.target.value))}
        step={step ?? 1} min={min ?? 0} max={max}
        className="max-w-xs"
      />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSubSettingsPage() {
  const { toast } = useToast()
  const [s, setS] = useState<SubSettings>(DEFAULT_SUB_SETTINGS)
  const [layaway, setLayaway] = useState<LayawaySlice>(LAYAWAY_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminFetch("/api/admin/sub-settings")
      .then(r => r.json())
      .then(json => { if (json?.settings) setS(prev => ({ ...prev, ...json.settings })) })
      .catch(() => {})
      .finally(() => setLoading(false))

    adminFetch("/api/admin/settings")
      .then(r => r.json())
      .then(json => {
        if (json?.settings) {
          setLayaway(prev => ({
            layawayEnabled: json.settings.layawayEnabled ?? prev.layawayEnabled,
            layawayMinDepositPercent: json.settings.layawayMinDepositPercent ?? prev.layawayMinDepositPercent,
            layawayMaxDepositPercent: json.settings.layawayMaxDepositPercent ?? prev.layawayMaxDepositPercent,
            layawayMinDepositFlatKobo: json.settings.layawayMinDepositFlatKobo ?? prev.layawayMinDepositFlatKobo,
            layawayMaxDepositFlatKobo: json.settings.layawayMaxDepositFlatKobo ?? prev.layawayMaxDepositFlatKobo,
            layawayMaxDays: json.settings.layawayMaxDays ?? prev.layawayMaxDays,
            layawayDefaultForfeitPercent: json.settings.layawayDefaultForfeitPercent ?? prev.layawayDefaultForfeitPercent,
          }))
        }
      })
      .catch(() => {})
  }, [])

  const bool = (key: keyof SubSettings) => () => setS(p => ({ ...p, [key]: !p[key] }))
  const num  = (key: keyof SubSettings) => (v: number) => setS(p => ({ ...p, [key]: v }))

  const toggleCategory = (slug: string) => () => setS(p => {
    const disabled = new Set(p.disabledCategorySlugs)
    if (disabled.has(slug)) disabled.delete(slug)
    else disabled.add(slug)
    return { ...p, disabledCategorySlugs: Array.from(disabled) }
  })

  const layawayBool = () => setLayaway(p => ({ ...p, layawayEnabled: !p.layawayEnabled }))
  const layawayNum = (key: keyof LayawaySlice) => (v: number) => setLayaway(p => ({ ...p, [key]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await adminFetch("/api/admin/sub-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Save failed (HTTP ${res.status})`)
      invalidateSubSettingsCache()

      // The main settings route does a full overwrite, not a merge, so we
      // must fetch the current full settings object first and merge our
      // layaway fields into it before posting -- posting only the layaway
      // slice would wipe every other platform setting (fees, commissions,
      // payment toggles) the moment this page is saved.
      const currentRes = await adminFetch("/api/admin/settings")
      const currentJson = await currentRes.json().catch(() => ({}))
      const mergedSettings = { ...(currentJson?.settings ?? {}), ...layaway }

      const layawayRes = await adminFetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mergedSettings),
      })
      const layawayJson = await layawayRes.json().catch(() => ({}))
      if (!layawayRes.ok) throw new Error(layawayJson?.error || `Layaway save failed (HTTP ${layawayRes.status})`)
      invalidateSettingsCache()

      toast({ title: "✅ Sub settings saved", description: "Changes applied instantly across the platform." })
    } catch (err: any) {
      toast({ title: "Error saving sub settings", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
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
          <Link href="/admin/settings" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3 w-3" /> Back to Settings
          </Link>
          <h1 className="text-2xl font-heading font-bold">Sub Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Smaller, newer settings live here so the main Settings page doesn't keep growing.
            All changes apply instantly — no code deployment needed.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Save All</>}
        </Button>
      </div>

      {/* ── Categories ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="h-4 w-4 text-primary" />
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Turn a category off to hide it from the homepage grid, nav, quick filters, category
            tabs, and the public categories pages, and block sellers from selecting it when
            posting a new listing. Existing listings already in a disabled category are not
            removed — they just won't be reachable through category browsing until it's re-enabled.
          </p>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Homepage</p>
            {HOMEPAGE_CATEGORIES.map(cat => (
              <ToggleRow
                key={cat.slug}
                label={cat.name}
                checked={!s.disabledCategorySlugs.includes(cat.slug)}
                onChange={toggleCategory(cat.slug)}
              />
            ))}
          </div>

          <Separator />

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">More Categories</p>
            {MORE_CATEGORIES.map(cat => (
              <ToggleRow
                key={cat.slug}
                label={cat.name}
                checked={!s.disabledCategorySlugs.includes(cat.slug)}
                onChange={toggleCategory(cat.slug)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Related Listings ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" />
            Related Listings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Controls the "You May Also Like" row shown on each listing's detail page,
            pulled from the same category.
          </p>
          <ToggleRow
            label="Related listings"
            desc="Shows a 'You may also like' row of similar listings on each listing's detail page"
            checked={s.relatedListingsEnabled}
            onChange={bool("relatedListingsEnabled")}
          />
          {s.relatedListingsEnabled && (
            <NumField
              label="Number of related listings"
              desc="How many similar listings to show (1–12)"
              value={s.relatedListingsCount}
              onChange={num("relatedListingsCount")}
              min={1} max={12} step={1}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Seller Coupon Codes ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" />
            Seller Coupon Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Lets sellers set a standing discount code on their own listing while creating it
            (a percentage off, with a code buyers enter at checkout). This does not affect
            escrow or payment flow — it's a price adjustment only.
          </p>
          <ToggleRow
            label="Seller coupon codes"
            desc="Shows the coupon step in the listing creation form so sellers can enable a code"
            checked={s.couponsEnabled}
            onChange={bool("couponsEnabled")}
          />
          {s.couponsEnabled && (
            <NumField
              label="Maximum discount sellers can set"
              desc="Upper bound (%) for the discount a seller can attach to their coupon code"
              value={s.couponMaxDiscountPercent}
              onChange={num("couponMaxDiscountPercent")}
              min={1} max={90} step={1}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Sponsored Products (listing detail page) ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Sponsored Products
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Shows a "Sponsored Products" row of boosted listings on each listing's detail page,
            above "You May Also Like". Pulls from the same boosted listings used on the homepage
            Featured Listings section, biased toward the current listing's category.
          </p>
          <ToggleRow
            label="Sponsored products"
            desc="Shows a horizontally scrollable row of boosted listings on each listing's detail page"
            checked={s.sponsoredListingsEnabled}
            onChange={bool("sponsoredListingsEnabled")}
          />
          {s.sponsoredListingsEnabled && (
            <NumField
              label="Number of sponsored products"
              desc="How many boosted listings to show (1–12)"
              value={s.sponsoredListingsCount}
              onChange={num("sponsoredListingsCount")}
              min={1} max={12} step={1}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Cart Abandonment Reminder ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Cart Abandonment Reminder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Carts live in the browser (localStorage), not on the server, so this nudge runs
            client-side: when a buyer returns with items sitting in their cart past the
            threshold below, they see a dismissible reminder banner encouraging checkout.
          </p>
          <ToggleRow
            label="Cart abandonment reminder"
            desc="Shows a dismissible banner nudging buyers to check out when cart items go stale"
            checked={s.cartAbandonmentEnabled}
            onChange={bool("cartAbandonmentEnabled")}
          />
          {s.cartAbandonmentEnabled && (
            <NumField
              label="Threshold (hours)"
              desc="How many hours an item must sit in the cart before the reminder shows"
              value={s.cartAbandonmentThresholdHours}
              onChange={num("cartAbandonmentThresholdHours")}
              min={1} max={168} step={1}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Free Delivery ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-primary" />
            Free Delivery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Shows a "Free Delivery" row on the homepage, pulling any listing where the
            seller/admin set the delivery fee override to 0 (the same flag behind the
            "Free Delivery" badge on listing cards). The full list is always browsable at
            <span className="font-mono"> /free-delivery</span> — this toggle only controls
            the homepage preview row.
          </p>
          <ToggleRow
            label="Free delivery section"
            desc="Shows a horizontally scrollable row of free-delivery listings on the homepage"
            checked={s.freeDeliveryEnabled}
            onChange={bool("freeDeliveryEnabled")}
          />
          {s.freeDeliveryEnabled && (
            <NumField
              label="Number of listings shown"
              desc="How many free-delivery listings to show on the homepage row (1–20)"
              value={s.freeDeliveryCount}
              onChange={num("freeDeliveryCount")}
              min={1} max={20} step={1}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Push Notifications ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Push Notifications (Master Switch)"
            desc="Turns the entire push feature on or off. When off, the browser opt-in prompt never shows and nothing is sent, regardless of the toggles below."
            checked={s.pushMasterEnabled}
            onChange={bool("pushMasterEnabled")}
          />
          <Separator />
          <ToggleRow
            label="New Listings From Followed Sellers"
            desc="Notify a buyer when a seller they follow posts a new listing that goes live."
            checked={s.pushNewListingEnabled}
            onChange={bool("pushNewListingEnabled")}
          />
          <ToggleRow
            label="Account Activity"
            desc="Order status changes, new messages, offers, disputes, and escrow release."
            checked={s.pushAccountActivityEnabled}
            onChange={bool("pushAccountActivityEnabled")}
          />
          <ToggleRow
            label="Price Drops"
            desc="Notify a buyer when a saved listing's price is reduced."
            checked={s.pushPriceDropEnabled}
            onChange={bool("pushPriceDropEnabled")}
          />
          <ToggleRow
            label="Back In Stock"
            desc="Notify a buyer when a listing they asked about is back in stock."
            checked={s.pushBackInStockEnabled}
            onChange={bool("pushBackInStockEnabled")}
          />
          <ToggleRow
            label="Layaway Reminders"
            desc="Upcoming due date, plan completed, and plan defaulted notices for layaway plans."
            checked={s.pushLayawayRemindersEnabled}
            onChange={bool("pushLayawayRemindersEnabled")}
          />
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground">Manage VAPID keys used to actually send push messages.</p>
            <Link href="/admin/push-settings">
              <Button variant="outline" size="sm">Open Key Settings</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ── Layaway ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            Layaway
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Layaway (Master Switch)"
            desc="Turns the whole layaway feature on or off. When off, sellers cannot enable it on any listing and buyers cannot start new plans."
            checked={layaway.layawayEnabled}
            onChange={layawayBool}
          />
          <div className="grid md:grid-cols-2 gap-4">
            <NumField
              label="Minimum Deposit %"
              desc="Lowest deposit percentage a seller is allowed to set, if they choose percentage."
              value={layaway.layawayMinDepositPercent}
              onChange={layawayNum("layawayMinDepositPercent")}
              min={1} max={100}
            />
            <NumField
              label="Maximum Deposit %"
              desc="Highest deposit percentage a seller is allowed to set, if they choose percentage."
              value={layaway.layawayMaxDepositPercent}
              onChange={layawayNum("layawayMaxDepositPercent")}
              min={1} max={100}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <NumField
              label="Minimum Flat Deposit (Naira)"
              desc="Lowest flat deposit amount a seller is allowed to set, if they choose a flat amount instead of a percentage."
              value={Math.round(layaway.layawayMinDepositFlatKobo / 100)}
              onChange={(v) => setLayaway(p => ({ ...p, layawayMinDepositFlatKobo: Math.round(v * 100) }))}
              min={0}
            />
            <NumField
              label="Maximum Flat Deposit (Naira)"
              desc="Highest flat deposit amount a seller is allowed to set."
              value={Math.round(layaway.layawayMaxDepositFlatKobo / 100)}
              onChange={(v) => setLayaway(p => ({ ...p, layawayMaxDepositFlatKobo: Math.round(v * 100) }))}
              min={0}
            />
          </div>
          <NumField
            label="Maximum Completion Days"
            desc="Longest window a seller can give a buyer to complete a plan."
            value={layaway.layawayMaxDays}
            onChange={layawayNum("layawayMaxDays")}
            min={1} max={365}
          />
          <Separator />
          <div>
            <Label className="text-sm font-medium">Layaway Exit Fee</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Charged when a buyer cancels a layaway plan early, or when a plan expires unpaid.
              Deducted from the buyer's refund. Shown to the buyer at checkout and again before
              they confirm a cancellation.
            </p>
            <div className="flex gap-2 mb-3">
              <Button
                type="button" size="sm"
                variant={s.layawayExitFeeType === "percent" ? "default" : "outline"}
                onClick={() => setS(p => ({ ...p, layawayExitFeeType: "percent" }))}
              >
                Percentage
              </Button>
              <Button
                type="button" size="sm"
                variant={s.layawayExitFeeType === "flat" ? "default" : "outline"}
                onClick={() => setS(p => ({ ...p, layawayExitFeeType: "flat" }))}
              >
                Flat Fee
              </Button>
            </div>
            {s.layawayExitFeeType === "percent" ? (
              <NumField
                label="Exit Fee Percentage"
                desc="Percentage of the amount already paid, kept as the exit fee."
                value={s.layawayExitFeePercent}
                onChange={num("layawayExitFeePercent")}
                min={0} max={100}
              />
            ) : (
              <NumField
                label="Exit Fee (Naira)"
                desc="Flat amount kept as the exit fee, regardless of how much was paid."
                value={Math.round(s.layawayExitFeeFlatKobo / 100)}
                onChange={(v) => setS(p => ({ ...p, layawayExitFeeFlatKobo: Math.round(v * 100) }))}
                min={0}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Placeholder for future settings ──────────────────────────────── */}
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Settings2 className="h-4 w-4 shrink-0" />
          Future small settings get added here — this page is designed to grow
          without touching the main Settings page again.
        </CardContent>
      </Card>
    </div>
  )
}
