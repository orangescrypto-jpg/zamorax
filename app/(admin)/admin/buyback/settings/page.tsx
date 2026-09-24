// app/(admin)/admin/buyback/settings/page.tsx
"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Trash2, RotateCcw } from "lucide-react"
import { adminFetch } from "@/lib/admin-fetch"
import { BuybackSettings, DEFAULT_BUYBACK_SETTINGS } from "@/lib/buyback/settings"

const KNOWN_CATEGORY_SLUGS = ["phones-tablets", "computing", "electronics"]

export default function AdminBuybackSettingsPage() {
  const { toast } = useToast()
  const [s, setS] = useState<BuybackSettings>(DEFAULT_BUYBACK_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/buyback/settings")
      .then(r => r.json())
      .then(d => { if (d.settings) setS(d.settings) })
      .catch(() => toast({ title: "Could not load settings", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [toast])

  const set = <K extends keyof BuybackSettings>(key: K, value: BuybackSettings[K]) =>
    setS(prev => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const res = await adminFetch("/api/buyback/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: s }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not save")
      if (json.settings) setS(json.settings)
      toast({ title: "Settings saved" })
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    if (!window.confirm("Reset all wording on this page to the defaults? You still need to press Save.")) return
    setS(DEFAULT_BUYBACK_SETTINGS)
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sell for Cash: Settings</h1>
          <p className="text-sm text-muted-foreground">
            Edit the wording and rules sellers see on the Sell for Cash page. Changes apply as soon as you save.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save
          </Button>
        </div>
      </div>

      {/* Page heading */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">Page heading</h2>
          <div className="space-y-2">
            <Label>Heading</Label>
            <Input value={s.heading} onChange={e => set("heading", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Subheading</Label>
            <Textarea rows={2} value={s.subheading} onChange={e => set("subheading", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Notice */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">Notice shown before the form</h2>
          <div className="space-y-2">
            <Label>Notice title</Label>
            <Input value={s.noticeTitle} onChange={e => set("noticeTitle", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notice lines</Label>
            {s.noticeLines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <Textarea
                  rows={2}
                  value={line}
                  onChange={e => set("noticeLines", s.noticeLines.map((l, idx) => idx === i ? e.target.value : l))}
                />
                <Button
                  variant="ghost" size="icon" className="text-destructive shrink-0"
                  onClick={() => set("noticeLines", s.noticeLines.filter((_, idx) => idx !== i))}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set("noticeLines", [...s.noticeLines, ""])}>
              <Plus className="h-4 w-4 mr-1.5" /> Add line
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Text under the "List it myself" button</Label>
            <Input value={s.listItYourselfText} onChange={e => set("listItYourselfText", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Confirmations */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Seller confirmations</h2>
            <p className="text-xs text-muted-foreground">
              Every box must be ticked before a seller can submit. The key is saved with each request, so do not change
              it for an existing confirmation. Staff verify ownership in person at the meet-up.
            </p>
          </div>
          {s.confirmations.map((c, i) => (
            <div key={i} className="grid sm:grid-cols-[160px_1fr_auto] gap-2 items-start">
              <Input
                value={c.key}
                onChange={e => set("confirmations", s.confirmations.map((x, idx) => idx === i ? { ...x, key: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() } : x))}
                placeholder="key"
                className="font-mono text-xs"
              />
              <Textarea
                rows={2}
                value={c.label}
                onChange={e => set("confirmations", s.confirmations.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
              />
              <Button
                variant="ghost" size="icon" className="text-destructive"
                onClick={() => set("confirmations", s.confirmations.filter((_, idx) => idx !== i))}
                aria-label="Remove confirmation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline" size="sm"
            onClick={() => set("confirmations", [...s.confirmations, { key: `confirm_${s.confirmations.length + 1}`, label: "" }])}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add confirmation
          </Button>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Categories</h2>
            <p className="text-xs text-muted-foreground">
              A category only appears if it has active rows on the Buyback Pricing page. Untick to hide one from sellers.
            </p>
          </div>
          {KNOWN_CATEGORY_SLUGS.map(slug => (
            <div key={slug} className="grid sm:grid-cols-[1fr_auto] gap-3 items-center">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-mono">{slug}</Label>
                <Input
                  value={s.categoryLabels[slug] ?? ""}
                  onChange={e => set("categoryLabels", { ...s.categoryLabels, [slug]: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm pt-5">
                <Checkbox
                  checked={!s.disabledCategories.includes(slug)}
                  onCheckedChange={v =>
                    set(
                      "disabledCategories",
                      v === true ? s.disabledCategories.filter(x => x !== slug) : [...s.disabledCategories, slug],
                    )
                  }
                />
                Show
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">Photos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimum photos</Label>
              <Input type="number" min={1} max={20} value={s.minPhotos} onChange={e => set("minPhotos", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Maximum photos</Label>
              <Input type="number" min={1} max={20} value={s.maxPhotos} onChange={e => set("maxPhotos", Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Help text</Label>
            <Input value={s.photoHelp} onChange={e => set("photoHelp", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Description note */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">Device description note</h2>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={s.descriptionLabel} onChange={e => set("descriptionLabel", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Help text</Label>
            <Textarea rows={2} value={s.descriptionHelp} onChange={e => set("descriptionHelp", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Placeholder</Label>
            <Input value={s.descriptionPlaceholder} onChange={e => set("descriptionPlaceholder", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Success message */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">Success message</h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={s.successTitle} onChange={e => set("successTitle", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea rows={3} value={s.successMessage} onChange={e => set("successMessage", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Trust points */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h2 className="font-semibold">Trust points</h2>
          {s.trustPoints.map((t, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-start">
              <Input
                value={t.title}
                onChange={e => set("trustPoints", s.trustPoints.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                placeholder="Title"
              />
              <Input
                value={t.text}
                onChange={e => set("trustPoints", s.trustPoints.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x))}
                placeholder="Short description"
              />
              <Button
                variant="ghost" size="icon" className="text-destructive"
                onClick={() => set("trustPoints", s.trustPoints.filter((_, idx) => idx !== i))}
                aria-label="Remove trust point"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set("trustPoints", [...s.trustPoints, { title: "", text: "" }])}>
            <Plus className="h-4 w-4 mr-1.5" /> Add trust point
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save settings
        </Button>
      </div>
    </div>
  )
}
