"use client"

import { useState } from "react"
import { MapPin, X } from "lucide-react"
import { useBuyerLocation } from "@/hooks/useBuyerLocation"
import { nigerianStates } from "@/constants/nigerianStates"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Small non-blocking bar shown once per session when we only have an
// IP-based guess for the buyer's state — lets them correct it in one tap
// without interrupting the page. Hidden entirely once a profile address,
// a manual choice, or no guess at all is in play.
export function LocationConfirmBanner() {
  const { state, source, setState } = useBuyerLocation()
  const [dismissed, setDismissed] = useState(false)
  const [changing, setChanging] = useState(false)

  if (dismissed || source !== "ip" || !state) return null

  return (
    <div className="flex items-center justify-between gap-3 bg-muted/60 border-b px-4 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
        {changing ? (
          <Select
            defaultValue={state}
            onValueChange={(v) => { setState(v); setChanging(false) }}
          >
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nigerianStates.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="truncate">
            Showing results near <strong>{state}</strong>,{" "}
            <button type="button" onClick={() => setChanging(true)} className="underline underline-offset-2">
              not you?
            </button>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
