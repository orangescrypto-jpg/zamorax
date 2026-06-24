// src/services/providers/cloudflare/recentlyViewed.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { Listing, RecentlyViewedItem } from "@/src/types"

function docId(userId: string, listingId: string) { return `${userId}_${listingId}` }

export const RecentlyViewedService = {

  async trackView(
    userId: string,
    listing: Pick<Listing, "id" | "title" | "images" | "priceSale" | "sellerId" | "nigerianState">,
  ): Promise<void> {
    await AdminService.setDoc("recently_viewed", docId(userId, listing.id), {
      user_id:       userId,
      listing_id:    listing.id,
      title:         listing.title,
      images:        JSON.stringify(listing.images ?? []),
      price_sale:    listing.priceSale,
      seller_id:     listing.sellerId,
      nigerian_state: listing.nigerianState ?? null,
      viewed_at:     new Date().toISOString(),
    }, { merge: true })
  },

  async getRecentlyViewed(userId: string, maxItems = 10): Promise<RecentlyViewedItem[]> {
    const parse = (v: unknown) => { try { return v ? JSON.parse(v as string) : [] } catch { return [] } }
    const all = (await AdminService.getCollection("recently_viewed")) as Record<string, unknown>[]
    return all
      .filter(r => String(r.user_id ?? r.userId) === userId)
      .sort((a, b) => new Date(String(b.viewed_at ?? b.viewedAt ?? 0)).getTime() - new Date(String(a.viewed_at ?? a.viewedAt ?? 0)).getTime())
      .slice(0, maxItems)
      .map(r => ({
        userId:       String(r.user_id    ?? r.userId),
        listingId:    String(r.listing_id ?? r.listingId),
        title:        String(r.title ?? ""),
        images:       parse(r.images),
        priceSale:    Number(r.price_sale ?? r.priceSale ?? 0),
        sellerId:     String(r.seller_id  ?? r.sellerId  ?? ""),
        nigerianState: r.nigerian_state ? String(r.nigerian_state) : undefined,
        viewedAt:     String(r.viewed_at  ?? r.viewedAt  ?? ""),
      } as RecentlyViewedItem))
  },
}
