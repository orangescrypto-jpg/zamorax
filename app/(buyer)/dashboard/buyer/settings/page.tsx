"use client"

import {AdminService, serverTimestamp} from "@/src/services"
// app/(buyer)/dashboard/buyer/settings/page.tsx
// Buyer settings: notifications, privacy, security, payment preferences

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

import {
  Bell, Shield, CreditCard, User, Eye, Lock,
  Loader2, Save, Trash2, LogOut, Globe,
} from "lucide-react"

export default function BuyerSettingsPage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [settings, setSettings] = useState({
    // Notifications
    emailOrderUpdates: true,
    emailOffers: true,
    emailAlerts: true,
    pushOrders: true,
    pushMessages: true,
    pushPriceDrops: true,
    pushPromotions: false,

    // Privacy
    showProfilePublicly: true,
    showOrderHistory: false,
    allowSellerContact: true,

    // Security
    twoFactorEnabled: false,

    // Preferences
    defaultCurrency: "NGN",
    preferredLanguage: "en",
  })

  useEffect(() => {
    if (!user?.uid) return
    AdminService.getDoc("userSettings", user.uid).then(doc => {
      if (doc) setSettings(s => ({ ...s, ...doc }))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.uid])

  const save = async () => {
    if (!user?.uid) return
    setSaving(true)
    try {
      await AdminService.updateDoc("userSettings", user.uid, {
        ...settings,
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Settings saved", description: "Your preferences have been updated." })
    } catch {
      // If doc doesn't exist yet, create it
      await AdminService.setDoc("userSettings", user.uid, {
        ...settings,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      })
      toast({ title: "Settings saved" })
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: keyof typeof settings) =>
    setSettings(s => ({ ...s, [key]: !s[key] }))

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account preferences and privacy.</p>
      </div>

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
            { key: "emailOrderUpdates" as const, label: "Order status updates", desc: "When your order is confirmed, shipped, or delivered" },
            { key: "emailOffers" as const,       label: "Offers & messages",     desc: "When sellers respond to your offers" },
            { key: "emailAlerts" as const,       label: "Search alerts",          desc: "When new listings match your saved searches" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Push</p>
          {[
            { key: "pushOrders" as const,     label: "Order updates",   desc: "Real-time order status" },
            { key: "pushMessages" as const,   label: "New messages",    desc: "Chat from sellers" },
            { key: "pushPriceDrops" as const, label: "Price drops",     desc: "When saved items go on sale" },
            { key: "pushPromotions" as const, label: "Promotions",      desc: "Flash deals and platform offers" },
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

      {/* Privacy Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" /> Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "showProfilePublicly" as const, label: "Public profile",       desc: "Sellers can see your buyer profile and badge" },
            { key: "showOrderHistory" as const,    label: "Order history",         desc: "Show completed order count on your profile" },
            { key: "allowSellerContact" as const,  label: "Allow seller messages", desc: "Sellers can initiate chat with you" },
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
              <p className="text-xs text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <Switch checked={settings.twoFactorEnabled} onCheckedChange={() => toggle("twoFactorEnabled")} />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Email address</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">To change your email, contact support.</p>
          </div>

          <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/5">
            <Lock className="h-4 w-4 mr-2" /> Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => { await signOut(); window.location.href = "/" }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out of All Devices
          </Button>
          <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/5">
            <Trash2 className="h-4 w-4 mr-2" /> Request Account Deletion
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end pb-4">
        <Button onClick={save} disabled={saving} className="bg-primary text-white min-w-32">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
        </Button>
      </div>
    </div>
  )
}
