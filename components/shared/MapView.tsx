"use client"

import { useState } from "react"
import { MapPin, X } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface MapListing {
  id: string
  title: string
  price: number
  images?: string[]
  location?: { state?: string; lga?: string }
}

interface MapViewProps {
  listings: MapListing[]
}

const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Lagos":        { lat: 6.5244,  lng: 3.3792 },
  "Abuja":        { lat: 9.0765,  lng: 7.3986 },
  "FCT":          { lat: 9.0765,  lng: 7.3986 },
  "Rivers":       { lat: 4.8156,  lng: 7.0498 },
  "Ogun":         { lat: 7.1600,  lng: 3.3500 },
  "Kano":         { lat: 12.0022, lng: 8.5920 },
  "Kaduna":       { lat: 10.5222, lng: 7.4383 },
  "Oyo":          { lat: 7.8774,  lng: 3.9470 },
  "Edo":          { lat: 6.3350,  lng: 5.6270 },
  "Delta":        { lat: 5.7040,  lng: 5.9340 },
  "Anambra":      { lat: 6.2100,  lng: 7.0670 },
  "Enugu":        { lat: 6.4483,  lng: 7.5139 },
  "Imo":          { lat: 5.4827,  lng: 7.0259 },
  "Akwa Ibom":    { lat: 5.0070,  lng: 7.8497 },
  "Cross River":  { lat: 5.9631,  lng: 8.3331 },
  "default":      { lat: 9.0820,  lng: 8.6753 },
}

export default function MapView({ listings }: MapViewProps) {
  const [selected, setSelected] = useState<MapListing | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY

  const stateClusters = listings.reduce((acc, listing) => {
    const state = listing.location?.state ?? "default"
    if (!acc[state]) acc[state] = []
    acc[state].push(listing)
    return acc
  }, {} as Record<string, MapListing[]>)

  if (!apiKey) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/50 rounded-2xl border border-border gap-3">
        <MapPin className="w-12 h-12 text-muted-foreground opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Map view not configured</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add <code className="bg-secondary px-1.5 py-0.5 rounded text-[11px]">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> to enable
          </p>
        </div>
      </div>
    )
  }

  const getMapUrl = () => {
    const coords = selected
      ? STATE_COORDS[selected.location?.state ?? "default"]
      : { lat: 9.0820, lng: 8.6753 }
    const zoom = selected ? 12 : 6
    return `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${coords.lat},${coords.lng}&zoom=${zoom}&maptype=roadmap`
  }

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-border">
      <iframe
        src={getMapUrl()}
        className="w-full h-full border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        onLoad={() => setMapLoaded(true)}
        title="Listings map"
      />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-secondary/80 flex items-center justify-center">
          <MapPin className="w-8 h-8 text-primary animate-pulse" />
        </div>
      )}
      <div className="absolute top-3 left-3 bg-card/90 backdrop-blur rounded-xl px-3 py-1.5 text-xs font-medium shadow-sm">
        {listings.length} listings across {Object.keys(stateClusters).length} states
      </div>
      <div className="absolute top-12 left-3 flex flex-col gap-1.5 max-h-[60%] overflow-y-auto">
        {Object.entries(stateClusters).sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([state, sl]) => (
          <button
            key={state}
            onClick={() => setSelected(sl[0])}
            className="bg-card/90 backdrop-blur rounded-xl px-2.5 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-all shadow-sm group"
          >
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-primary group-hover:text-primary-foreground" />
              <span className="text-xs font-semibold">{state}</span>
              <span className="text-[10px] text-muted-foreground group-hover:text-primary-foreground/70 ml-auto">{sl.length}</span>
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="absolute bottom-4 left-4 right-4 max-w-sm bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="relative h-28">
            <Image
              src={selected.images?.[0] ?? "/placeholder-product.jpg"}
              alt={selected.title}
              fill
              className="object-cover"
              sizes="320px"
            />
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold line-clamp-1">{selected.title}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3" />
              <span>{selected.location?.lga}, {selected.location?.state}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm font-bold text-primary">₦{selected.price?.toLocaleString()}</p>
              <Link href={`/listings/${selected.id}`} className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg hover:bg-primary/90 transition-colors">
                View →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
