"use client"

import { useState } from "react"
import { Tag, X, CheckCircle, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

interface PromoResult {
  valid: boolean
  promoId: string
  code: string
  discount: number
  description: string
}

interface PromoCodeInputProps {
  userId: string
  amount: number
  onApply: (result: PromoResult | null) => void
}

export function PromoCodeInput({ userId, amount, onApply }: PromoCodeInputProps) {
  const { settings } = usePlatformSettings()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [applied, setApplied] = useState<PromoResult | null>(null)

  if (!settings.promoEnabled) return null

  const validate = async () => {
    if (!code.trim()) return
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), userId, amount }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Invalid code"); return }

      // Enforce max discount cap from platform settings
      if (settings.maxPromoDiscountPercent > 0 && amount > 0) {
        const maxDiscount = Math.floor(amount * (settings.maxPromoDiscountPercent / 100))
        if (data.discount > maxDiscount) {
          data.discount = maxDiscount
        }
      }

      setApplied(data)
      onApply(data)
    } catch { setError("Network error") }
    finally { setLoading(false) }
  }

  const clear = () => { setApplied(null); setCode(""); setError(""); onApply(null) }

  if (applied) return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-emerald-700">{applied.code}</p>
        <p className="text-xs text-emerald-600">{applied.description}</p>
      </div>
      <button onClick={clear} className="text-emerald-500 hover:text-emerald-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  )

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Promo code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && validate()}
            className="pl-8 h-9 text-sm uppercase"
          />
        </div>
        <Button onClick={validate} disabled={!code.trim() || loading} size="sm" variant="outline" className="h-9 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
