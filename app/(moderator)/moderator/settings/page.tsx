"use client"

import {AdminService, limit, serverTimestamp} from "@/src/services"
// app/(moderator)/moderator/settings/page.tsx
// Moderator settings: notification preferences, work preferences, security.

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  Bell, Shield, Clock, Flag, ShieldAlert,
  Loader2, Save, LogOut, User, ListChecks,
} from "lucide-react"

export default function ModeratorSettingsPage() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [settings, setSettings] = useState({
    // Work preferences
    defaultListingView: "pending",       // pending | all
    autoAssignDisputes: true,
    maxActiveDisputesAtOnce: 20,
    showAutoResolvedItems: true,
    timezone: "Africa/Lagos",

    // Notifications
    emailNewDispute: true,
    emailNewReport: true,
    emailEscalation: true,
    emailDailyDigest: true,
    pushNewDispute: true,
    pushNewReport: true,
    pushEscalation: true,
    pushUrgentOnly: false,

    // Security
    twoFactorEnabled: false,
    sessionTimeoutMinutes: 60,
  })

  useEffect(() => {
    if (!user?.uid) return
    AdminService.getDoc("moderatorSettings", user.uid).then(snap => {
      if (snap.exists()) setSettings(s => ({ ...s, ...snap.data() }))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.uid])

  const save = async () => {
    if (!user?.uid) return
    setSaving(true)
    try {
      await AdminService.setDoc("moderatorSettings", user.uid, {
        ...settings,
        userId: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      toast({ title: "Settings saved" })
    } catch {
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" })
    } finally {
      setSaving(false)
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
        <h1 className="text-2xl font-heading font-bold">Moderator Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure your moderation preferences and alerts.</p>
      </div>

      {/* Work Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" /> Work Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Default listing view</Label>
            <Select value={settings.defaultListingView} onValueChange={v => set("defaultListingView", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending listings only</SelectItem>
                <SelectItem value="all">All listings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Auto-assign disputes</p>
              <p className="text-xs text-muted-foreground">Automatically receive new disputes up to your active limit</p>
            </div>
            <Switch checked={settings.autoAssignDisputes} onCheckedChange={() => toggle("autoAssignDisputes")} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Max active disputes</Label>
            <Select value={String(settings.maxActiveDisputesAtOnce)} onValueChange={v => set("maxActiveDisputesAtOnce", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 15, 20, 25, 30].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} disputes</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Show auto-resolved items</p>
              <p className="text-xs text-muted-foreground">Include auto-resolved disputes and reports in your queue view</p>
            </div>
            <Switch checked={settings.showAutoResolvedItems} onCheckedChange={() => toggle("showAutoResolvedItems")} />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</p>
          {[
            { key: "emailNewDispute" as const,  label: "New dispute assigned" },
            { key: "emailNewReport" as const,   label: "New listing report" },
            { key: "emailEscalation" as const,  label: "Escalation alerts" },
            { key: "emailDailyDigest" as const, label: "Daily summary digest" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
              <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}

          <Separator />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Push</p>
          {[
            { key: "pushNewDispute" as const,  label: "New dispute" },
            { key: "pushNewReport" as const,   label: "New report" },
            { key: "pushEscalation" as const,  label: "Escalations" },
            { key: "pushUrgentOnly" as const,  label: "Urgent items only" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <p className="text-sm font-medium">{label}</p>
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
              <p className="text-xs text-muted-foreground">Required for all moderation actions</p>
            </div>
            <Switch checked={settings.twoFactorEnabled} onCheckedChange={() => toggle("twoFactorEnabled")} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Session timeout</Label>
            <Select value={String(settings.sessionTimeoutMinutes)} onValueChange={v => set("sessionTimeoutMinutes", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="480">8 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />
          <div className="space-y-2">
            <Label className="text-sm">Email address</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted" />
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" /> Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => { await signOut(); window.location.href = "/" }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
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
