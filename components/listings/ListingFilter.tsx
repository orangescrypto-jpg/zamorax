"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { nigerianStates } from "@/constants/nigerianStates"
import { Search, X, Filter, ShieldCheck } from "lucide-react"
import { useState } from "react"

export function ListingFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  // Helper to build URL params
  const createQueryString = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(name, value)
    else params.delete(name)
    return params.toString()
  }

  const currentParams = {
    q: searchParams.get("q") || "",
    state: searchParams.get("state") || "",
    type: searchParams.get("type") || "",
    condition: searchParams.get("condition") || "",
    min: searchParams.get("min") || "",
    max: searchParams.get("max") || "",
    sort: searchParams.get("sort") || "",
    official: searchParams.get("official") || "",
  }

  const applyFilter = (key: string, value: string) => {
    router.push(`${pathname}?${createQueryString(key, value)}`)
  }

  const clearFilters = () => router.push(pathname)

  return (
    <aside className={`w-full md:w-64 bg-background border-r md:h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto ${isOpen ? "fixed inset-0 z-50 bg-background p-6 overflow-y-auto" : "hidden md:block"}`}>
      {isOpen && (
        <div className="flex items-center justify-between mb-6 md:hidden">
          <h2 className="font-heading font-bold text-xl">Filters</h2>
          <button onClick={() => setIsOpen(false)}><X className="h-6 w-6" /></button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 md:hidden">
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Filter className="h-4 w-4 mr-2" /> Filters
        </Button>
        <button onClick={clearFilters} className="text-sm text-primary font-medium">Clear All</button>
      </div>

      <div className="space-y-6 px-1">
        {/* Search Input (Mobile only, hidden on desktop as Navbar has it) */}
        <div className="md:hidden">
          <Input 
            placeholder="Search listings..." 
            value={currentParams.q}
            onChange={(e) => applyFilter("q", e.target.value)}
            className="bg-muted/50"
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label>State / Location</Label>
          <select
            value={currentParams.state}
            onChange={(e) => applyFilter("state", e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Nigeria</option>
            {nigerianStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        <Separator />

        {/* Zamorax Enterprises Direct — official Zamorax Enterprises listings only.
            Works on every category page too, since categories route
            through /search?category=slug with this same param appended. */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={currentParams.official === "true"}
              onCheckedChange={() => applyFilter("official", currentParams.official === "true" ? "" : "true")}
            />
            <span className="text-sm font-medium flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Zamorax Enterprises Direct only
            </span>
          </label>
          <p className="text-xs text-muted-foreground pl-6">Sold and shipped by Zamorax Enterprises, in stock, fast delivery</p>
        </div>

        <Separator />

        {/* Listing Type */}
        <div className="space-y-2">
          <Label>Type</Label>
          <div className="space-y-2">
            {["sale", "rent"].map(type => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={currentParams.type === type} 
                  onCheckedChange={() => applyFilter("type", currentParams.type === type ? "" : type)} 
                />
                <span className="text-sm capitalize">{type}</span>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Condition */}
        <div className="space-y-2">
          <Label>Condition</Label>
          <div className="space-y-2">
            {["brand_new", "open_box", "grade_a", "grade_b"].map(cond => (
              <label key={cond} className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={currentParams.condition === cond} 
                  onCheckedChange={() => applyFilter("condition", currentParams.condition === cond ? "" : cond)} 
                />
                <span className="text-sm capitalize">{cond.replace("_", " ")}</span>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Sort */}
        <div className="space-y-2">
          <Label>Sort By</Label>
          <select
            value={currentParams.sort}
            onChange={(e) => applyFilter("sort", e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Most Recent</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="newest">Newest First</option>
          </select>
        </div>

        <Separator />

        {/* Price Range */}
        <div className="space-y-4">
          <Label>Price Range (₦)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={currentParams.min}
              onChange={(e) => applyFilter("min", e.target.value)}
              className="bg-background"
            />
            <Input
              type="number"
              placeholder="Max"
              value={currentParams.max}
              onChange={(e) => applyFilter("max", e.target.value)}
              className="bg-background"
            />
          </div>
        </div>
      </div>
      
      {/* Mobile Apply Button */}
      <div className="mt-8 md:hidden">
        <Button onClick={() => setIsOpen(false)} className="w-full">Apply Filters</Button>
      </div>
    </aside>
  )
}
