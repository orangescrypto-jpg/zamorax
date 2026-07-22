"use client"
// components/admin/SettingsFields.tsx
// Shared field/section primitives used across admin settings-style pages
// (global settings page, logistics rates tab, etc). Extracted so pages
// don't duplicate these components.

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ChevronDown, ChevronUp } from "lucide-react"

export function SectionCard({
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

export function NumField({ label, desc, value, onChange, prefix, suffix, step, min, max }: {
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

export function KoboField({ label, desc, value, onChange }: {
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

export function ToggleRow({ label, desc, checked, onChange }: {
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

export function StrField({ label, desc, value, onChange, placeholder }: {
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

export function InfoBox({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "amber" | "red" | "green" }) {
  const cls = {
    blue:  "bg-blue-50 border-blue-100 text-blue-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    red:   "bg-red-50 border-red-100 text-red-700",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
  }[color]
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>
  )
}
