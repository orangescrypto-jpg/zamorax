"use client"

import { useEffect, useState } from "react"
import { ListingsService } from "@/src/services"
import { ListingCard } from "@/components/listings/ListingCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CATEGORY_RENT_RULES } from "@/constants/rentRules"
import type { Listing } from "@/src/types"
import {
  CalendarDays, Shield, RefreshCcw, Truck,
  SlidersHorizontal, ChevronDown
} from "lucide-react"

const RENTABLE_CATEGORIES = Object.entries(CATEGORY_RENT_RULES)
  .filter(([, rule]) => rule.allowsRent)
  .map(([slug]) => slug)

const CATEGORY_LABELS: Record<string, string> = {
  "phones-tablets": "Phones & Tablets",
  "computing": "Computing",
  "electronics": "Electronics",
  "fashion": "Fashion",
  "home-office": "Home & Office",
  "sporting-goods": "Sporting Goods",
  "vehicles": "Vehicles",
  "furniture": "Furniture",
  "building-construction": "Building & Construction",
  "solar-energy": "Solar & Energy",
  "agricultural-farming": "Agricultural",
  "event-party": "Events & Party",
  "heavy-equipment-power": "Heavy Equipment",
  "musical-instruments": "Musical Instruments",
  "industrial-manufacturing": "Industrial",
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
]

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export default function RentalsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sort, setSort] = useState("newest")
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setLoading(true)
    ListingsService.getListings({
      listingType: "rent",
      ...(activeCategory ? { category: activeCategory } : {}),
    })
      .then(res => setListings(res.items ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [activeCategory])

  const sorted = [...listings].sort((a: any, b: any) => {
    if (sort === "price_asc") return (a.priceRentDaily ?? 0) - (b.priceRentDaily ?? 0)
    if (sort === "price_desc") return (b.priceRentDaily ?? 0) - (a.priceRentDaily ?? 0)
    return 0 // newest — Firestore already returns newest first
  })

  return (
    <div className="space-y-0">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 py-14 px-4">
        <div className="container mx-auto max-w-3xl text-center space-y-4">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/80 bg-white/10 px-3 py-1 rounded-full">
            <CalendarDays className="w-3.5 h-3.5" /> Zamorax Rentals
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
            Rent Anything.<br className="hidden md:block" /> Return When Done.
          </h1>
          <p className="text-lg text-white/85 max-w-xl mx-auto">
            Phones, laptops, vehicles, party equipment, solar systems and more — all protected by Zamorax escrow and deposit insurance.
          </p>

          {/* Trust pills */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {[
              { icon: Shield, text: "Deposit held in escrow" },
              { icon: RefreshCcw, text: "Easy returns" },
              { icon: Truck, text: "Doorstep pickup" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5 bg-white/15 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                <Icon className="w-3.5 h-3.5" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              !activeCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            All
          </button>
          {RENTABLE_CATEGORIES.map(slug => (
            <button
              key={slug}
              onClick={() => setActiveCategory(activeCategory === slug ? null : slug)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {CATEGORY_LABELS[slug] ?? slug}
            </button>
          ))}
        </div>

        {/* Sort bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading..." : `${sorted.length} item${sorted.length !== 1 ? "s" : ""} available`}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="font-semibold text-foreground">No rentals available yet</p>
            <p className="text-sm text-muted-foreground">
              {activeCategory
                ? "No items in this category yet. Try another."
                : "Be the first to list an item for rent!"}
            </p>
            {activeCategory && (
              <Button variant="outline" size="sm" onClick={() => setActiveCategory(null)}>
                View all categories
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {sorted.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* How it works strip */}
        {!loading && sorted.length > 0 && (
          <div className="mt-12 rounded-2xl bg-amber-50 border border-amber-100 p-6 md:p-8">
            <h3 className="text-lg font-bold text-amber-900 mb-4 text-center">How Zamorax Rentals Work</h3>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              {[
                { step: "1", title: "Choose & Book", desc: "Pick your item, select dates, pay rental + refundable deposit — all in escrow." },
                { step: "2", title: "Use It", desc: "Item is delivered or collected. Use it for your agreed rental period." },
                { step: "3", title: "Return & Refund", desc: "Return the item, seller inspects it, deposit is refunded to you within 24hrs." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold text-lg flex items-center justify-center mx-auto">
                    {step}
                  </div>
                  <p className="font-semibold text-amber-900">{title}</p>
                  <p className="text-sm text-amber-700">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
