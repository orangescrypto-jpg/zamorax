"use client"

import { AdminService, serverTimestamp, where } from "@/src/services"
// app/(seller)/dashboard/seller/settings/page.tsx
// Seller settings: store preferences, vacation mode, payout config, notifications, security, danger zone.

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import {
  Bell, Shield, CreditCard, Store, Eye, Lock,
  Loader2, Save, Trash2, LogOut, Package,
  Truck, Percent, Clock, Users, PalmtreeIcon,
} from "lucide-react"

export default function SellerSettingsPage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const { settings: platformSettings } = usePlatformSettings()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [vacationSaving, setVacationSaving] = useState(false)

  const [settings, setSettings] = useState({
    // Store
    acceptsOffers: true,
    autoAcceptOffersBelow: false,
    autoAcceptThreshold: 90,      // % of listed price
    holidayMode: false,
    holidayMessage: "",
    processingTimeDays: 1,
    shippingPolicy: "",
    returnPolicy: "",

    // Payout
    bankName: "",
    accountNumber: "",
    accountName: "",
    autoPayoutEnabled: false,
    autoPayoutThreshold: 50000,   // Naira kobo: 50,000₦

    // Notifications
    emailNewOrder: true,
    emailNewOffer: true,
    emailNewMessage: true,
    emailDisputeUpdate: true,
    emailWeeklySummary: true,
    pushNewOrder: true,
    pushNewOffer: true,
    pushNewMessage: true,

    // Privacy
    showRevenuePublicly: false,
    showSalesCount: true,
    allowBuyerReviews: true,

    // Security
    twoFactorEnabled: false,
    requireLoginForCheckout: false,
  })

  // Vacation mode state (stored on user doc, not sellerSettings)
  const [vacationMode,       setVacationMode]       = useState(false)
  const [vacationReturnDate, setVacationReturnDate] = useState("")
  const [vacationMessage,    setVacationMessage]    = useState("")

  useEffect(() => {
    if (!user?.uid) return

    Promise.all([
      fetch("/api/seller/settings").then(r => r.json()).then(j => j.settings),
      AdminService.getDoc("users", user.uid),
    ]).then(([docs, userDoc]) => {
      if (docs) setSettings(s => ({ ...s, ...docs }))
      if (userDoc) {
        setVacationMode((userDoc as any).vacationMode ?? false)
        setVacationReturnDate((userDoc as any).vacationReturnDate ?? "")
        setVacationMessage((userDoc as any).vacationMessage ?? "")
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.uid])

  const save = async () => {
    if (!user?.uid) return
    setSaving(true)
    try {
      const res = await fetch("/api/seller/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) throw new Error("Save failed")
      toast({ title: "Settings saved", description: "Your store preferences have been updated." })
    } catch {
      toast({ title: "Error saving", description: "Please try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const saveVacationMode = async (newMode: boolean) => {
    if (!user?.uid) return
    setVacationSaving(true)
    try {
      // Update user profile with vacation mode
      await AdminService.updateDoc("users", user.uid, {
        vacationMode:       newMode,
        vacationReturnDate: newMode ? (vacationReturnDate || null) : null,
        vacationMessage:    newMode ? (vacationMessage || null) : null,
        updatedAt:          serverTimestamp(),
      })

      // Toggle isActive on all seller's active listings
      const listingsSnap = await AdminService.getCollection("listings", [
        where("sellerId", "==", user.uid),
        ...(newMode
          ? [where("status", "==", "active"), where("isActive", "==", true)]
          : [where("sellerId", "==", user.uid), where("vacationMode", "==", true)]
        ),
      ])

      // Batch update listings
      for (const listing of listingsSnap) {
        await AdminService.updateDoc("listings", listing.id, newMode
          ? { isActive: false, vacationMode: true, vacationReturnDate: vacationReturnDate || null, updatedAt: serverTimestamp() }
          : { isActive: true, vacationMode: false, vacationReturnDate: null, updatedAt: serverTimestamp() }
        )
      }

      setVacationMode(newMode)
      toast({
        title: newMode ? "🏖️ Vacation mode on" : "Welcome back!",
        description: newMode
          ? `Your ${listingsSnap.length} listing${listingsSnap.length !== 1 ? "s are" : " is"} paused`
          : `Your listings are now active again`,
        variant: "success",
      })
    } catch {
      toast({ title: "Error updating vacation mode", variant: "destructive" })
    } finally {
      setVacationSaving(false)
    }
  }

  const toggle = (key: keyof typeof settings) =>
    setSettings(s => ({ ...s, [key]: !s[key as keyof typeof s] }))

  const set = (key: keyof typeof settings, value: unknown) =>
    setSettings(s => ({ ...s, [key]: value }))

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Seller Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your store, payouts, and notification preferences.</p>
      </div>

      {/* Store Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-primary" /> Store Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Accept Offers</p>
              <p className="text-xs text-muted-foreground">Allow buyers to make price offers on your listings</p>
            </div>
            <Switch checked={settings.acceptsOffers} onCheckedChange={() => toggle("acceptsOffers")} />
          </div>

          {settings.acceptsOffers && (
            <div className="flex items-center justify-between gap-3 pl-4 border-l-2 border-muted">
              <div>
                <p className="text-sm font-medium">Auto-accept offers</p>
                <p className="text-xs text-muted-foreground">
                  Automatically accept offers above {settings.autoAcceptThreshold}% of listed price
                </p>
              </div>
              <Switch checked={settings.autoAcceptOffersBelow} onCheckedChange={() => toggle("autoAcceptOffersBelow")} />
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Holiday Mode</p>
              <p className="text-xs text-muted-foreground">Pause your store temporarily — listings stay visible but can't be purchased</p>
            </div>
            <Switch checked={settings.holidayMode} onCheckedChange={() => toggle("holidayMode")} />
          </div>

          {settings.holidayMode && (
            <div className="space-y-1.5">
              <Label className="text-sm">Holiday message (shown to buyers)</Label>
              <Textarea
                placeholder="e.g. Back on 20th June — orders placed now will be processed on return."
                value={settings.holidayMessage}
                onChange={e => set("holidayMessage", e.target.value)}
                rows={2}
              />
            </div>
          )}

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Processing time</Label>
            <Select value={String(settings.processingTimeDays)} onValueChange={v => set("processingTimeDays", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,5,7].map((d: any) => (
                  <SelectItem key={d} value={String(d)}>{d} business day{d > 1 ? "s" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Shipping policy</Label>
            <Textarea
              placeholder="Describe how you handle shipping, delivery times, packaging..."
              value={settings.shippingPolicy}
              onChange={e => set("shippingPolicy", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Return & refund policy</Label>
            <Textarea
              placeholder="Describe your return conditions, window, and process..."
              value={settings.returnPolicy}
              onChange={e => set("returnPolicy", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Vacation Mode ──────────────────────────────────────────────────── */}
      {platformSettings.vacationModeEnabled && (
        <Card className={vacationMode ? "border-blue-300 ring-1 ring-blue-200" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              🏖️ Vacation Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              When vacation mode is on, all your active listings are paused — buyers see you're away and cannot purchase. Your listings automatically restore when you turn it off.
            </p>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {vacationMode ? "🏖️ Vacation mode is ON" : "Vacation mode is off"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vacationMode ? "Your listings are currently paused" : "Your store is active"}
                </p>
              </div>
              <Switch
                checked={vacationMode}
                onCheckedChange={saveVacationMode}
                disabled={vacationSaving}
              />
            </div>

            {vacationMode && (
              <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                <div className="space-y-1.5">
                  <Label className="text-xs">Return date (optional)</Label>
                  <Input
                    type="date"
                    value={vacationReturnDate}
                    onChange={e => setVacationReturnDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Shown to buyers on your listings</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vacation message (optional)</Label>
                  <Input
                    value={vacationMessage}
                    onChange={e => setVacationMessage(e.target.value)}
                    placeholder="e.g. Back June 28. DMs welcome!"
                    className="text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveVacationMode(true)}
                  disabled={vacationSaving}
                  className="text-xs"
                >
                  {vacationSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Update vacation details
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payout Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" /> Payout Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Bank account details are saved securely. Full payouts are managed in your <a href="/dashboard/seller/wallet" className="text-primary underline">Wallet</a>.
          </p>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Bank Name</Label>
              <Input placeholder="e.g. Zenith Bank" value={settings.bankName} onChange={e => set("bankName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Account Number</Label>
              <Input placeholder="10-digit NUBAN" maxLength={10} value={settings.accountNumber} onChange={e => set("accountNumber", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Account Name</Label>
              <Input placeholder="As on bank record" value={settings.accountName} onChange={e => set("accountName", e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Auto-payout</p>
              <p className="text-xs text-muted-foreground">
                Automatically request payout when balance exceeds ₦{(settings.autoPayoutThreshold / 100).toLocaleString()}
              </p>
            </div>
            <Switch checked={settings.autoPayoutEnabled} onCheckedChange={() => toggle("autoPayoutEnabled")} />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</p>
          {[
            { key: "emailNewOrder" as const,       label: "New order received" },
            { key: "emailNewOffer" as const,        label: "New offer from buyer" },
            { key: "emailNewMessage" as const,      label: "New message" },
            { key: "emailDisputeUpdate" as const,   label: "Dispute updates" },
            { key: "emailWeeklySummary" as const,   label: "Weekly sales summary" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Push</p>
          {[
            { key: "pushNewOrder" as const,   label: "New order" },
            { key: "pushNewOffer" as const,   label: "New offer" },
            { key: "pushNewMessage" as const, label: "New message" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" /> Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "showSalesCount" as const,    label: "Show sales count",     desc: "Display total sales on your public store page" },
            { key: "allowBuyerReviews" as const, label: "Allow buyer reviews",  desc: "Buyers can leave reviews on completed orders" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">Secure your seller account with 2FA</p>
            </div>
            <Switch checked={settings.twoFactorEnabled} onCheckedChange={() => toggle("twoFactorEnabled")} />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm">Email address</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted" />
          </div>
          <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/5">
            <Lock className="h-4 w-4 mr-2" /> Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => { await signOut(); window.location.href = "/" }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
          <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/5">
            <Trash2 className="h-4 w-4 mr-2" /> Deactivate Seller Account
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end pb-4">
        <Button onClick={save} disabled={saving} className="bg-primary text-white min-w-36">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
        </Button>
      </div>
    </div>
  )
}
