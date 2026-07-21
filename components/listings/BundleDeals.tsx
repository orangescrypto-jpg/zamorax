"use client"
// components/listings/BundleDeals.tsx
// Buyer-facing bundle promo shown on a listing's detail page when that
// listing is included in one or more active seller-created bundles.
// Reads directly from the `bundles` Firestore-shape collection via
// AdminService, same as the seller bundle-management page — there is no
// dedicated D1 table/route for bundles, so this stays client-side.

import { useEffect, useState } from "react"
import { AdminService, where } from "@/src/services"
import { formatPrice } from "@/lib/utils"
import { Package, Tag } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface Bundle {
  id: string
  name: string
  sellerId: string
  sellerName: string
  listingIds: string[]
  listingTitles: string[]
  listingImages: (string | null)[]
  originalPrice: number
  discountPercent: number
  bundlePrice: number
  saving: number
  status: string
}

export function BundleDeals({ listingId }: { listingId: string }) {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    AdminService.getCollection("bundles", [
      where("listingIds", "array-contains", listingId),
      where("status", "==", "active"),
    ])
      .then((rows) => { if (active) setBundles(rows as unknown as Bundle[]) })
      .catch(() => { if (active) setBundles([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [listingId])

  if (loading || bundles.length === 0) return null

  return (
    <div className="space-y-2">
      {bundles.map((bundle) => (
        <div
          key={bundle.id}
          className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Package className="h-4 w-4 shrink-0" />
            Bundle Deal: {bundle.name}
          </div>

          <div className="flex gap-1.5">
            {bundle.listingImages?.slice(0, 4).map((img, i) => (
              <div key={i} className="relative w-11 h-11 rounded-lg bg-muted overflow-hidden shrink-0 border border-border">
                {img
                  ? <Image src={img} alt="" fill className="object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">?</div>
                }
              </div>
            ))}
            {bundle.listingIds.length > 4 && (
              <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0 border border-border">
                +{bundle.listingIds.length - 4}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Get this item with {bundle.listingIds.length - 1} other item{bundle.listingIds.length - 1 === 1 ? "" : "s"} from{" "}
            <span className="font-medium text-foreground">{bundle.sellerName}</span>
          </p>

          <div className="flex items-center gap-3">
            <div>
              <p className="text-lg font-bold text-primary">{formatPrice(bundle.bundlePrice)}</p>
              <p className="text-xs text-muted-foreground line-through">{formatPrice(bundle.originalPrice)}</p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1">
              <Tag className="h-3 w-3" /> Save {formatPrice(bundle.saving)} ({bundle.discountPercent}% off)
            </div>
          </div>

          <Link
            href={`/seller/${bundle.sellerId}?bundle=${bundle.id}`}
            className="inline-flex items-center justify-center w-full h-9 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
          >
            View Bundle
          </Link>
        </div>
      ))}
    </div>
  )
}
