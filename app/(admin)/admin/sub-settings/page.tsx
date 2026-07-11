"use client"
// app/(admin)/admin/sub-settings/page.tsx
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
import { Loader2, Save, ArrowLeft, ListChecks, Settings2 } from "lucide-react"
import {
  DEFAULT_SUB_SETTINGS,
  type SubSettings,
} from "@/src/services/subSettings"
import { invalidateSubSettingsCache } from "@/hooks/useSubSettings"

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminFetch("/api/admin/sub-settings")
      .then(r => r.json())
      .then(json => { if (json?.settings) setS(prev => ({ ...prev, ...json.settings })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const bool = (key: keyof SubSettings) => () => setS(p => ({ ...p, [key]: !p[key] }))
  const num  = (key: keyof SubSettings) => (v: number) => setS(p => ({ ...p, [key]: v }))

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
