// src/services/providers/cloudflare/priceAlerts.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { PriceAlert, Listing } from "@/src/types"

function docId(userId: string, listingId: string) { return `${userId}_${listingId}` }

export const PriceAlertsService = {

  async setAlert(userId: string, listingId: string, targetPriceKobo: number,
    listing: Pick<Listing, "id" | "title" | "images" | "priceSale" | "sellerId">
  ): Promise<void> {
    await AdminService.setDoc("price_alerts", docId(userId, listingId), {
      user_id:       userId,
      listing_id:    listingId,
      listing_title: listing.title,
      listing_image: listing.images?.[0] ?? null,
      seller_id:     listing.sellerId,
      current_price: listing.priceSale,
      target_price:  targetPriceKobo,
      status:        "active",
    }, { merge: true })
  },

  async getAlert(userId: string, listingId: string): Promise<PriceAlert | null> {
    const row = await AdminService.getDoc("price_alerts", docId(userId, listingId)) as Record<string, unknown> | null
    if (!row) return null
    return {
      userId:       String(row.user_id    ?? row.userId),
      listingId:    String(row.listing_id ?? row.listingId),
      listingTitle: String(row.listing_title ?? row.listingTitle ?? ""),
      listingImage: row.listing_image ? String(row.listing_image) : null,
      sellerId:     String(row.seller_id ?? row.sellerId ?? ""),
      currentPrice: Number(row.current_price ?? row.currentPrice ?? 0),
      targetPrice:  Number(row.target_price  ?? row.targetPrice  ?? 0),
      status:       String(row.status ?? "active"),
      createdAt:    String(row.created_at ?? ""),
      updatedAt:    String(row.updated_at ?? ""),
    } as PriceAlert
  },

  async cancelAlert(userId: string, listingId: string): Promise<void> {
    await AdminService.updateDoc("price_alerts", docId(userId, listingId), { status: "cancelled" })
  },

  async deleteAlert(userId: string, listingId: string): Promise<void> {
    await AdminService.deleteDoc("price_alerts", docId(userId, listingId))
  },

  async getUserAlerts(userId: string): Promise<PriceAlert[]> {
    const all = (await AdminService.getCollection("price_alerts")) as Record<string, unknown>[]
    return all
      .filter(r => String(r.user_id ?? r.userId) === userId && String(r.status) === "active")
      .map(r => ({
        userId:       String(r.user_id    ?? r.userId),
        listingId:    String(r.listing_id ?? r.listingId),
        listingTitle: String(r.listing_title ?? r.listingTitle ?? ""),
        listingImage: r.listing_image ? String(r.listing_image) : null,
        sellerId:     String(r.seller_id ?? r.sellerId ?? ""),
        currentPrice: Number(r.current_price ?? r.currentPrice ?? 0),
        targetPrice:  Number(r.target_price  ?? r.targetPrice  ?? 0),
        status:       String(r.status ?? "active"),
        createdAt:    String(r.created_at ?? ""),
        updatedAt:    String(r.updated_at ?? ""),
      } as PriceAlert))
  },
}
