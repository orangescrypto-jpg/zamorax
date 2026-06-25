// src/services/providers/cloudflare/offers.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { IOffersService } from "@/src/services/offers"
import type { Offer } from "@/src/types"

function mapRow(row: Record<string, unknown>): Offer {
  return {
    ...row,
    id:            String(row.id),
    listingId:     String(row.listing_id    ?? row.listingId    ?? ""),
    listingTitle:  String(row.listing_title ?? row.listingTitle ?? ""),
    listingImage:  String(row.listing_image ?? row.listingImage ?? ""),
    originalPrice: Number(row.original_price ?? row.originalPrice ?? 0),
    offerAmount:   Number(row.offer_amount   ?? row.offerAmount   ?? 0),
    buyerId:       String(row.buyer_id    ?? row.buyerId    ?? ""),
    buyerName:     String(row.buyer_name  ?? row.buyerName  ?? ""),
    sellerId:      String(row.seller_id   ?? row.sellerId   ?? ""),
    sellerName:    String(row.seller_name ?? row.sellerName ?? ""),
    chatId:        row.chat_id ? String(row.chat_id) : undefined,
    status:        String(row.status ?? "pending"),
    expiresAt:     String(row.expires_at ?? row.expiresAt ?? ""),
    counterAmount: row.counter_amount ? Number(row.counter_amount) : undefined,
    respondedAt:   row.responded_at ? String(row.responded_at) : undefined,
    createdAt:     String(row.created_at ?? new Date().toISOString()),
    updatedAt:     String(row.updated_at ?? new Date().toISOString()),
  } as Offer
}

export const OffersService: IOffersService = {

  async makeOffer(data) {
    const expiresAt = new Date(Date.now() + 86400000).toISOString()
    return AdminService.addDoc("offers", {
      listing_id:    data.listingId,
      listing_title: data.listingTitle,
      listing_image: data.listingImage,
      original_price: data.originalPrice,
      offer_amount:  data.offerAmount,
      buyer_id:      data.buyerId,
      buyer_name:    data.buyerName,
      seller_id:     data.sellerId,
      seller_name:   data.sellerName,
      message:       data.message ?? null,
      status:        "pending",
      expires_at:    expiresAt,
    })
  },

  async respondToOffer(offerId, action, counterAmount) {
    await AdminService.updateDoc("offers", offerId, {
      status:        action,
      responded_at:  new Date().toISOString(),
      ...(counterAmount !== undefined ? { counter_amount: counterAmount } : {}),
    })

    if (action === "accepted") {
      const all = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
      const offerData = all.find(r => String(r.id) === offerId)
      if (offerData) {
        const docId = `${offerData.listing_id ?? offerData.listingId}_${offerData.buyer_id ?? offerData.buyerId}`
        await AdminService.setDoc("accepted_offers", docId, {
          offer_id:      offerId,
          listing_id:    offerData.listing_id ?? offerData.listingId,
          listing_title: offerData.listing_title ?? offerData.listingTitle,
          buyer_id:      offerData.buyer_id ?? offerData.buyerId,
          seller_id:     offerData.seller_id ?? offerData.sellerId,
          agreed_price:  offerData.offer_amount ?? offerData.offerAmount,
          original_price: offerData.original_price ?? offerData.originalPrice,
          status:        "active",
          accepted_at:   new Date().toISOString(),
        })
      }
    }
  },

  async acceptCounterOffer(offerId, counterAmount) {
    await AdminService.updateDoc("offers", offerId, {
      status:       "accepted",
      responded_at: new Date().toISOString(),
    })
    const all = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
    const offerData = all.find(r => String(r.id) === offerId)
    if (offerData) {
      const docId = `${offerData.listing_id ?? offerData.listingId}_${offerData.buyer_id ?? offerData.buyerId}`
      await AdminService.setDoc("accepted_offers", docId, {
        offer_id:      offerId,
        listing_id:    offerData.listing_id ?? offerData.listingId,
        listing_title: offerData.listing_title ?? offerData.listingTitle,
        buyer_id:      offerData.buyer_id ?? offerData.buyerId,
        seller_id:     offerData.seller_id ?? offerData.sellerId,
        agreed_price:  counterAmount,
        original_price: offerData.original_price ?? offerData.originalPrice,
        status:        "active",
        accepted_at:   new Date().toISOString(),
      })
    }
  },

  async getAcceptedOffer(listingId, buyerId) {
    const docId = `${listingId}_${buyerId}`
    const row = await AdminService.getDoc("accepted_offers", docId) as Record<string, unknown> | null
    if (!row || row.status !== "active") return null
    return {
      offerId:       String(row.offer_id ?? row.offerId),
      agreedPrice:   Number(row.agreed_price ?? row.agreedPrice),
      originalPrice: Number(row.original_price ?? row.originalPrice),
      acceptedAt:    String(row.accepted_at ?? row.acceptedAt ?? ""),
    }
  },

  async markOfferUsed(listingId, buyerId) {
    const docId = `${listingId}_${buyerId}`
    await AdminService.updateDoc("accepted_offers", docId, { status: "used" })
  },

  async getOffersByBuyer(buyerId) {
    const all = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
    return all
      .filter(r => String(r.buyer_id ?? r.buyerId) === buyerId)
      .sort((a: any, b: any) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .map(mapRow)
  },

  async getOffersBySeller(sellerId) {
    const all = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
    return all
      .filter(r => String(r.seller_id ?? r.sellerId) === sellerId)
      .sort((a: any, b: any) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .map(mapRow)
  },
}
