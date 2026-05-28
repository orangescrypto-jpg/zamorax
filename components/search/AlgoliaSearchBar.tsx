"use client"
// components/search/AlgoliaSearchBar.tsx

import { useState, useRef, useEffect } from "react"
import { searchClient, LISTINGS_INDEX } from "@/lib/algolia/client"
import { Search, X, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { formatPrice } from "@/lib/utils"
import { query } from "@/src/services"

interface Hit {
  objectID: string
  title: string
  priceSale: number
  images: string[]
  nigerianState: string
  city: string
  _snippetResult?: { description?: { value: string } }
}

export function AlgoliaSearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)
  const [hits, setHits] = useState<Hit[]>([])
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<NodeJS.Timeout | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const idx = searchClient.initIndex(LISTINGS_INDEX)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    clearTimeout(debounce.current)
    if (!value.trim()) { setHits([]); setSuggestion(null); setOpen(false); return }

    setLoading(true)
    debounce.current = setTimeout(async () => {
      try {
        const res = await idx.search<Hit>(value, {
          hitsPerPage: 5,
          attributesToSnippet: ["description:10"],
          snippetEllipsisText: "…",
          typoTolerance: true,
        })

        setHits(res.hits)
        // "Did you mean?" — show when Algolia corrected a typo
        const corrected = (res as any).queryAfterRemoval || null
        setSuggestion(corrected && corrected !== value ? corrected : null)
        setOpen(true)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }, 180)
  }

  const handleSubmit = (q = query) => {
    if (!q.trim()) return
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const clear = () => { setQuery(""); setHits([]); setSuggestion(null); setOpen(false) }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-2xl">
      {/* Input */}
      <div className="flex items-center gap-2 bg-white border-2 border-border rounded-xl px-3 h-12 shadow-sm focus-within:border-primary transition-colors">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Search phones, cars, furniture..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
        {query && !loading && (
          <button onClick={clear} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => handleSubmit()}
          className="bg-primary text-white text-sm font-semibold px-4 h-8 rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          Search
        </button>
      </div>

      {/* Dropdown */}
      {open && (hits.length > 0 || suggestion) && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden">

          {/* Did you mean? */}
          {suggestion && (
            <button
              onClick={() => { setQuery(suggestion); handleSubmit(suggestion) }}
              className="w-full text-left px-4 py-2.5 text-sm border-b border-border hover:bg-muted/50 transition-colors"
            >
              <span className="text-muted-foreground">Did you mean: </span>
              <span className="font-semibold text-primary">{suggestion}</span>
            </button>
          )}

          {/* Quick results */}
          {hits.map(hit => (
            <button
              key={hit.objectID}
              onClick={() => { setOpen(false); router.push(`/listings/${hit.objectID}`) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="relative w-10 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
                {hit.images?.[0] && (
                  <Image src={hit.images[0]} alt="" fill className="object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{hit.title}</p>
                <p className="text-xs text-muted-foreground">{hit.city}, {hit.nigerianState}</p>
              </div>
              <p className="text-sm font-bold text-primary shrink-0">
                {formatPrice(hit.priceSale)}
              </p>
            </button>
          ))}

          {/* See all results */}
          <button
            onClick={() => handleSubmit()}
            className="w-full text-center py-2.5 text-sm text-primary font-semibold border-t border-border hover:bg-primary/5 transition-colors"
          >
            See all results for "{query}"
          </button>
        </div>
      )}
    </div>
  )
}
