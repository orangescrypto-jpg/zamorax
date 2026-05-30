"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Heart, Share2, MapPin, ShieldCheck, BadgeCheck, Star, Crown, Clock } from "lucide-react"
import { cn, formatPrice, truncateText } from "@/lib/utils"
import type { Listing } from "@/src/types"
import { useToast } from "@/components/ui/use-toast"
import { SellerTrustScore } from "@/components/shared/SellerTrustScore"

const conditionStyles: Record<string, { bg: string; text: string; label: string }> = {
  brand_new: { bg: "bg-blue-100", text: "text-blue-700", label: "Brand New" },
  open_box: { bg: "bg-purple-100", text: "text-purple-700", label: "Open Box" },
  grade_a: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Grade A" },
  grade_b: { bg: "bg-amber-100", text: "text-amber-700", label: "Grade B" },
}

const planBadges: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pro: { icon: <Crown className="h-3 w-3" />, color: "text-amber-500", label: "Pro" },
  starter: { icon: <Star className="h-3 w-3" />, color: "text-gray-500", label: "Starter" },
}

export function ListingCard({ listing }: { listing: Listing }) {
  const { toast } = useToast()
  const [saved, setSaved] = useState(false)

  const handleShare = () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/listings/${listing.id}` : "#"
    if (navigator.share) {
      navigator.share({ title: listing.title, url })
    } else {
      navigator.clipboard.writeText(url)
      toast({ title: "Link Copied", description: "Share via WhatsApp or any app" })
    }
  }

  const cond = conditionStyles[listing.condition] || conditionStyles.grade_a
  const plan = planBadges[listing.sellerPlan || ""]
  const timeAgo = listing.createdAt ? formatDistanceToNow(typeof listing.createdAt === "string" ? new Date(listing.createdAt) : listing.createdAt.toDate(), { addSuffix: true }) : ""

  const whatsappLink = typeof window !== "undefined" ? `https://wa.me/?text=Check out ${listing.title} on Zamorax: ${window.location.origin}/listings/${listing.id}` : "#"

  return (
    <article className="group relative flex flex-col bg-card rounded-xl border border-border/50 overflow-hidden transition-all hover:shadow-md hover:border-primary/30">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={listing.images[0] || "/placeholder-listing.jpg"}
          alt={listing.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          loading="lazy"
        />
        
        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5">
          {listing.isBoosted && (
            <span className="px-2 py-0.5 bg-primary/90 text-white text-[10px] font-bold uppercase tracking-wider rounded-sm shadow-sm">
              Sponsored
            </span>
          )}
          <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-sm", cond.bg, cond.text)}>
            {cond.label}
          </span>
        </div>

        {/* Save Button */}
        <button
          onClick={() => setSaved(!saved)}
          className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur rounded-full hover:bg-white transition shadow-sm"
          aria-label={saved ? "Unsave listing" : "Save listing"}
        >
          <Heart className={cn("h-4 w-4 transition-colors", saved ? "fill-red-500 text-red-500" : "text-gray-600")} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {truncateText(listing.title, 50)}
          </h3>
        </div>

        {/* Price Section */}
        <div className="space-y-1">
          <p className="text-base font-bold text-primary truncate">
            {formatPrice(listing.priceSale)}
          </p>
          {listing.listingType !== "sale" && listing.priceRentDaily && (
            <p className="text-xs text-muted-foreground">
              or {formatPrice(listing.priceRentDaily)} / day rent
            </p>
          )}
        </div>

        {/* Seller Trust Score */}
        <div className="flex items-center justify-between mt-1">
          <SellerTrustScore
            ninVerified={listing.sellerVerified || false}
            bvnVerified={false}
            sellerRating={listing.sellerRating || 0}
            totalSales={0}
            totalRentals={0}
            size="sm"
          />
          {plan && (
            <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", plan.color)}>
              {plan.icon} {plan.label}
            </span>
          )}
        </div>

        {/* Location & Time */}
        <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {listing.city}, {listing.nigerianState}
          </span>
          {timeAgo && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo}</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
          <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded transition">
            <Share2 className="h-3 w-3" /> Share
          </button>
          <Link href={whatsappLink} target="_blank" className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50 rounded transition">
            WhatsApp
          </Link>
        </div>
      </div>
    </article>
  )
}
