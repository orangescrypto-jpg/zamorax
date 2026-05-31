"use client"
// components/home/HomeQuickFilters.tsx
// Quick filter bar shown on homepage — category, price range, location
// Navigates to /search with params. Follows existing ListingFilter + Hero patterns.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { nigerianStates } from "@/constants/nigerianStates"
import { ALL_CATEGORIES } from "@/constants/categories"
import { cn } from "@/lib/utils"

const PRICE_RANGES = [
  { label: "Under ₦5k",   min: 0,      max: 500000 },
  { label: "₦5k–₦20k",   min: 500000, max: 2000000 },
  { label: "₦20k–₦100k", min: 2000000, max: 10000000 },
  { label: "₦100k+",      min: 10000000, max: 0 },
]

export function HomeQuickFilters() {
  const router = useRouter()
  const [category, setCategory] = useState("")
  const [state, setState] = useState("")
  const [priceRange, setPriceRange] = useState<(typeof PRICE_RANGES)[0] | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const hasFilters = category || state || priceRange

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (category) params.set("category", category)
    if (state) params.set("state", state)
    if (priceRange?.min) params.set("min", String(priceRange.min))
    if (priceRange?.max) params.set("max", String(priceRange.max))
    router.push(`/search?${params.toString()}`)
  }

  const clearAll = () => {
    setCategory("")
    setState("")
    setPriceRange(null)
  }

  return (
    <div className="space-y-3">
      {/* Toggle row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
            showFilters
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-foreground hover:border-primary/50"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasFilters && (
            <span className="ml-1 bg-primary-foreground text-primary text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {[category, state, priceRange].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Active filter chips */}
        {category && (
          <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
            {ALL_CATEGORIES.find(c => c.slug === category)?.name}
            <button onClick={() => setCategory("")}><X className="h-3 w-3" /></button>
          </span>
        )}
        {state && (
          <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
            <MapPin className="h-3 w-3" />{state}
            <button onClick={() => setState("")}><X className="h-3 w-3" /></button>
          </span>
        )}
        {priceRange && (
          <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
            {priceRange.label}
            <button onClick={() => setPriceRange(null)}><X className="h-3 w-3" /></button>
          </span>
        )}

        {hasFilters && (
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-destructive ml-auto">
            Clear all
          </button>
        )}
      </div>

      {/* Expanded filter panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
          {/* Category */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map(cat => (
                <button
                  key={cat.slug}
                  onClick={() => setCategory(category === cat.slug ? "" : cat.slug)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                    category === cat.slug
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Price Range</p>
            <div className="flex flex-wrap gap-1.5">
              {PRICE_RANGES.map(range => (
                <button
                  key={range.label}
                  onClick={() => setPriceRange(priceRange?.label === range.label ? null : range)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                    priceRange?.label === range.label
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <MapPin className="inline h-3 w-3 mr-1" />Location
            </p>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="">All Nigeria</option>
              {nigerianStates.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Apply */}
          <Button
            onClick={() => { applyFilters(); setShowFilters(false) }}
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl"
          >
            <Search className="h-4 w-4 mr-2" />
            Show Results
          </Button>
        </div>
      )}
    </div>
  )
}
