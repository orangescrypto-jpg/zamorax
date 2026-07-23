"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { HOMEPAGE_CATEGORIES, MORE_CATEGORIES } from "@/constants/categories"
import {
  Phone, Laptop, Monitor, Shirt, Car, Sofa, Home, Pill,
  Hammer, Sun, Wheat, PartyPopper, Zap, Gamepad2, ShoppingCart,
  Wrench, Music, PawPrint, Factory, BookOpen, Baby, Trophy, MoreHorizontal,
  ChevronDown, ChevronUp
} from "lucide-react"

const iconMap: Record<string, React.ReactNode> = {
  "phones-tablets":          <Phone className="h-5 w-5" />,
  "computing":               <Laptop className="h-5 w-5" />,
  "electronics":             <Monitor className="h-5 w-5" />,
  "fashion":                 <Shirt className="h-5 w-5" />,
  "vehicles":                <Car className="h-5 w-5" />,
  "furniture":               <Sofa className="h-5 w-5" />,
  "home-office":             <Home className="h-5 w-5" />,
  "health-beauty":           <Pill className="h-5 w-5" />,
  "building-construction":   <Hammer className="h-5 w-5" />,
  "solar-energy":            <Sun className="h-5 w-5" />,
  "agricultural-farming":    <Wheat className="h-5 w-5" />,
  "event-party":             <PartyPopper className="h-5 w-5" />,
  "heavy-equipment-power":   <Zap className="h-5 w-5" />,
  "kids-toys":               <Gamepad2 className="h-5 w-5" />,
  "groceries":               <ShoppingCart className="h-5 w-5" />,
  "automotive-parts":        <Wrench className="h-5 w-5" />,
  "musical-instruments":     <Music className="h-5 w-5" />,
  "pet-supplies":            <PawPrint className="h-5 w-5" />,
  "industrial-manufacturing":<Factory className="h-5 w-5" />,
  "books-education":         <BookOpen className="h-5 w-5" />,
  "baby-products":           <Baby className="h-5 w-5" />,
  "sporting-goods":          <Trophy className="h-5 w-5" />,
  "other":                   <MoreHorizontal className="h-5 w-5" />,
}

const colorMap: Record<string, { bg: string; icon: string }> = {
  "phones-tablets":          { bg: "bg-blue-50",    icon: "text-blue-600" },
  "computing":               { bg: "bg-violet-50",  icon: "text-violet-600" },
  "electronics":             { bg: "bg-indigo-50",  icon: "text-indigo-600" },
  "fashion":                 { bg: "bg-pink-50",    icon: "text-pink-600" },
  "vehicles":                { bg: "bg-slate-50",   icon: "text-slate-600" },
  "furniture":               { bg: "bg-amber-50",   icon: "text-amber-700" },
  "home-office":             { bg: "bg-emerald-50", icon: "text-emerald-600" },
  "health-beauty":           { bg: "bg-rose-50",    icon: "text-rose-600" },
  "building-construction":   { bg: "bg-stone-50",   icon: "text-stone-600" },
  "solar-energy":            { bg: "bg-yellow-50",  icon: "text-yellow-600" },
  "agricultural-farming":    { bg: "bg-lime-50",    icon: "text-lime-600" },
  "event-party":             { bg: "bg-fuchsia-50", icon: "text-fuchsia-600" },
  "heavy-equipment-power":   { bg: "bg-orange-50",  icon: "text-orange-600" },
  "kids-toys":               { bg: "bg-cyan-50",    icon: "text-cyan-600" },
  "groceries":               { bg: "bg-green-50",   icon: "text-green-600" },
  "automotive-parts":        { bg: "bg-zinc-50",    icon: "text-zinc-600" },
  "musical-instruments":     { bg: "bg-purple-50",  icon: "text-purple-600" },
  "pet-supplies":            { bg: "bg-teal-50",    icon: "text-teal-600" },
  "industrial-manufacturing":{ bg: "bg-gray-100",   icon: "text-gray-600" },
  "books-education":         { bg: "bg-sky-50",     icon: "text-sky-600" },
  "baby-products":           { bg: "bg-amber-50",   icon: "text-amber-600" },
  "sporting-goods":          { bg: "bg-orange-50",  icon: "text-orange-600" },
  "other":                   { bg: "bg-gray-50",    icon: "text-gray-500" },
}

function CategoryTile({ cat }: { cat: { slug: string; name: string } }) {
  const icon  = iconMap[cat.slug]  || iconMap["other"]
  const color = colorMap[cat.slug] || colorMap["other"]
  return (
    <Link
      href={`/categories/${cat.slug}`}
      className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-white border border-border/40 hover:shadow-md hover:border-primary/20 transition-all text-center group w-full h-full"
    >
      <div className={`p-2 rounded-xl ${color.bg} ${color.icon} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-secondary leading-tight line-clamp-2">
        {cat.name}
      </span>
    </Link>
  )
}

export function CategoryGrid() {
  // Static grid of the top 8 categories by demand (see constants/categories.ts).
  // "See More Categories" expands the remaining ones in place, right below
  // the grid, instead of navigating to /search — keeps the buyer on the
  // homepage to just glance at what else exists.
  const topCategories = HOMEPAGE_CATEGORIES.slice(0, 8)
  const [expanded, setExpanded] = useState(false)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-secondary">Browse Categories</h2>
        <Link href="/search" className="text-xs text-primary font-medium">See all →</Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {topCategories.map(cat => <CategoryTile key={cat.id} cat={cat} />)}
      </div>

      {expanded && (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {MORE_CATEGORIES.map(cat => <CategoryTile key={cat.id} cat={cat} />)}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-primary font-medium py-2 rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors"
      >
        {expanded ? (
          <>See Fewer Categories <ChevronUp className="h-3.5 w-3.5" /></>
        ) : (
          <>See More Categories <ChevronDown className="h-3.5 w-3.5" /></>
        )}
      </button>
    </section>
  )
}
