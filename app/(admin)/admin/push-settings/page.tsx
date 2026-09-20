"use client"
// app/(admin)/admin/push-settings/page.tsx
// Admin page for Web Push (VAPID). Two independent things happen here:
//   1. Key management -- generate or paste a VAPID key pair, saved to D1
//      via /api/admin/push-settings. Falls back to
//      NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars if no
//      key is saved here.
//   2. Feature toggles -- master switch plus one switch per notification
//      type, saved into the sub_settings doc alongside the platform's
//      other newer settings (src/services/subSettings.ts).

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
import {
  Loader2, Save, ArrowLeft, Bell, KeyRound, RefreshCw, Trash2, ShieldCheck,
} from "lucide-react"
import {
  DEFAULT_SUB_SETTINGS,
  type SubSettings,
} from "@/src/services/subSettings"
import { invalidateSubSettingsCache } from "@/hooks/useSubSettings"

function ToggleRow({
  label, desc, checked, onChange, disabled,
}: {
  label: string; desc?: string; checked: boolean; onChange: () => void; disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

interface VapidStatus {
  configured: boolean
  source: "database" | "env" | "none"
  publicKey: string | null
  subject: string | null
}

export default function AdminPushSettingsPage() {
  const { toast } = useToast()
  const [s, setS] = useState<SubSettings>(DEFAULT_SUB_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [vapid, setVapid] = useState<VapidStatus | null>(null)
  const [vapidLoading, setVapidLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingKeys, setSavingKeys] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [draftPublic, setDraftPublic] = useState("")
  const [draftPrivate, setDraftPrivate] = useState("")
  const [draftSubject, setDraftSubject] = useState("mailto:support@zamorax.com")

  useEffect(() => {
    adminFetch("/api/admin/sub-settings")
      .then(r => r.json())
      .then(json => { if (json?.settings) setS(prev => ({ ...prev, ...json.settings })) })
      .catch(() => {})
      .finally(() => setLoading(false))

    adminFetch("/api/admin/push-settings")
      .then(r => r.json())
      .then((json: VapidStatus) => {
        setVapid(json)
        if (json?.subject) setDraftSubject(json.subject)
      })
      .catch(() => {})
      .finally(() => setVapidLoading(false))
  }, [])

  const bool = (key: keyof SubSettings) => () => setS(p => ({ ...p, [key]: !p[key] }))

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
      toast({ title: "Push settings saved", description: "Changes apply instantly across the platform." })
    } catch (err: any) {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const generateKeys = async () => {
    setGenerating(true)
    try {
      const res = await adminFetch("/api/admin/push-vapid-generate", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to generate keys")
      setDraftPublic(json.publicKey)
      setDraftPrivate(json.privateKey)
      toast({
        title: "New key pair generated",
        description: "Review it below, then click Save Keys to activate it.",
      })
    } catch (err: any) {
      toast({ title: "Error generating keys", description: err.message, variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const saveKeys = async () => {
    if (!draftPublic || !draftPrivate) {
      toast({ title: "Missing keys", description: "Generate or paste both keys first.", variant: "destructive" })
      return
    }
    setSavingKeys(true)
    try {
      const res = await adminFetch("/api/admin/push-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: draftPublic, privateKey: draftPrivate, subject: draftSubject }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || "Failed to save keys")
      toast({ title: "VAPID keys saved", description: "Push notifications are now active using these keys." })
      setVapid({ configured: true, source: "database", publicKey: draftPublic, subject: draftSubject })
      setDraftPrivate("")
    } catch (err: any) {
      toast({ title: "Error saving keys", description: err.message, variant: "destructive" })
    } finally {
      setSavingKeys(false)
    }
  }

  const clearKeys = async () => {
    setClearing(true)
    try {
      const res = await adminFetch("/api/admin/push-settings", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to clear keys")
      toast({ title: "Saved keys cleared", description: "Falling back to environment variables, if set." })
      const statusRes = await adminFetch("/api/admin/push-settings")
      setVapid(await statusRes.json())
      setDraftPublic("")
      setDraftPrivate("")
    } catch (err: any) {
      toast({ title: "Error clearing keys", description: err.message, variant: "destructive" })
    } finally {
      setClearing(false)
    }
  }

  if (loading || vapidLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 max-w-2xl space-y-5 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/sub-settings" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3 w-3" /> Back to Sub Settings
          </Link>
          <h1 className="text-2xl font-heading font-bold">Push Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage Web Push (VAPID) keys and which notification types are sent to subscribed browsers.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Save Toggles</>}
        </Button>
      </div>

      {/* ── VAPID key management ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            VAPID Keys
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
            <ShieldCheck className={`h-4 w-4 shrink-0 ${vapid?.configured ? "text-emerald-600" : "text-muted-foreground"}`} />
            <div className="text-xs">
              {vapid?.configured ? (
                <p>
                  <span className="font-medium">Active</span> -- keys loaded from{" "}
                  <span className="font-medium">{vapid.source === "database" ? "this admin panel" : "environment variables"}</span>.
                </p>
              ) : (
                <p className="text-muted-foreground">No keys configured yet. Generate a pair below or set the environment variables.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Generate a new pair, or paste your own if you already have one. Saving here overrides the
            NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY environment variables -- clearing removes the override.
          </p>

          <Button variant="outline" size="sm" onClick={generateKeys} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Generate New Key Pair
          </Button>

          <div className="space-y-2">
            <Label className="text-xs">Public Key</Label>
            <Input
              value={draftPublic}
              onChange={e => setDraftPublic(e.target.value)}
              placeholder={vapid?.publicKey || "Generate or paste a public key"}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Private Key</Label>
            <Input
              value={draftPrivate}
              onChange={e => setDraftPrivate(e.target.value)}
              placeholder="Generate or paste a private key -- never shown again after saving"
              type="password"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Contact Subject (mailto:)</Label>
            <Input
              value={draftSubject}
              onChange={e => setDraftSubject(e.target.value)}
              placeholder="mailto:support@zamorax.com"
              className="text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Required by the Web Push protocol so browsers can contact you about your server's push usage.
            </p>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={saveKeys} disabled={savingKeys}>
              {savingKeys ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Keys
            </Button>
            <Button size="sm" variant="ghost" onClick={clearKeys} disabled={clearing || vapid?.source !== "database"}>
              {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Clear Saved Keys
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Feature toggles ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Notification Types
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
            disabled={!s.pushMasterEnabled}
          />
          <ToggleRow
            label="Account Activity"
            desc="Order status changes, new messages, offers, disputes, and escrow release -- anything concerning the logged in user's own account."
            checked={s.pushAccountActivityEnabled}
            onChange={bool("pushAccountActivityEnabled")}
            disabled={!s.pushMasterEnabled}
          />
          <ToggleRow
            label="Price Drops"
            desc="Notify a buyer when a saved listing's price is reduced."
            checked={s.pushPriceDropEnabled}
            onChange={bool("pushPriceDropEnabled")}
            disabled={!s.pushMasterEnabled}
          />
          <ToggleRow
            label="Back In Stock"
            desc="Notify a buyer when a listing they asked about is back in stock."
            checked={s.pushBackInStockEnabled}
            onChange={bool("pushBackInStockEnabled")}
            disabled={!s.pushMasterEnabled}
          />
          <ToggleRow
            label="Layaway Reminders"
            desc="Upcoming due date, plan completed, and plan defaulted notices for layaway plans."
            checked={s.pushLayawayRemindersEnabled}
            onChange={bool("pushLayawayRemindersEnabled")}
            disabled={!s.pushMasterEnabled}
          />
        </CardContent>
      </Card>
    </div>
  )
}
