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
    counterAmount: (row.counter_amount ?? row.counterAmount) ? Number(row.counter_amount ?? row.counterAmount) : undefined,
    respondedAt:   row.responded_at ? String(row.responded_at) : undefined,
    createdAt:     String(row.created_at ?? new Date().toISOString()),
    updatedAt:     String(row.updated_at ?? new Date().toISOString()),
  } as Offer
}

function parseJson(v: unknown): any {
  try { return v ? JSON.parse(v as string) : undefined } catch { return undefined }
}

// The standalone "My Offers" pages (buyer/seller) and the chat offer bubbles
// are two independent views of the same offer: the offers table row, and
// each chat message's embedded offerData JSON blob. chat.ts already keeps
// both in sync when actions happen *inside* chat (accept/decline/counter),
// but actions taken from the standalone Offers pages only ever wrote to the
// offers table — leaving the original chat bubble stuck showing "pending"
// forever, even after the buyer accepted/declined from the Offers page.
// This mirrors the status (and counter amount, if any) into every chat
// message whose offerData.offerId matches, so both surfaces agree.
async function syncOfferToChatMessages(offerId: string, chatId: string | undefined, status: string) {
  if (!chatId) return
  try {
    const rows = (await AdminService.getCollection("messages", [
      { field: "chat_id", op: "==", value: chatId } as any,
    ])) as Record<string, unknown>[]
    for (const row of rows) {
      const envelope = parseJson(row.content)
      if (!envelope?.offerData || String(envelope.offerData.offerId) !== offerId) continue
      envelope.offerData = { ...envelope.offerData, status }
      await AdminService.updateDoc("messages", String(row.id), { content: JSON.stringify(envelope) })
    }
  } catch {
    // Best-effort sync — the offers table remains the source of truth even
    // if this fails, so we don't want a chat-sync error to block the
    // buyer/seller's accept/decline/counter action from completing.
  }
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
      ...(data.message ? { message: data.message } : {}),
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

    const all = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
    const offerRow = all.find(r => String(r.id) === offerId)
    await syncOfferToChatMessages(offerId, offerRow?.chat_id ? String(offerRow.chat_id) : (offerRow as any)?.chatId, action)

    if (action === "accepted") {
      const offerData = offerRow
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
    await syncOfferToChatMessages(offerId, offerData?.chat_id ? String(offerData.chat_id) : (offerData as any)?.chatId, "accepted")
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
    const accepted = await AdminService.getDoc("accepted_offers", docId) as Record<string, unknown> | null
    await AdminService.updateDoc("accepted_offers", docId, { status: "used" })

    // Once an accepted offer has been spent on an order, it's no longer a
    // "live" offer — flip the underlying offers-table row (and its chat
    // bubble) to "expired" so it can no longer be re-used or re-displayed
    // as an actionable offer, and becomes eligible for admin cleanup.
    const offerId = accepted?.offer_id ?? (accepted as any)?.offerId
    if (offerId) {
      await AdminService.updateDoc("offers", String(offerId), {
        status:       "expired",
        responded_at: new Date().toISOString(),
      }).catch(() => {})
      const all = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
      const offerRow = all.find(r => String(r.id) === String(offerId))
      await syncOfferToChatMessages(
        String(offerId),
        offerRow?.chat_id ? String(offerRow.chat_id) : (offerRow as any)?.chatId,
        "expired",
      ).catch(() => {})
    }
  },

  async expireStaleOffers() {
    const nowIso = new Date().toISOString()
    // Any pending/accepted offer whose 24h window has passed and hasn't
    // been used yet gets flipped to "expired". Accepted-but-unused offers
    // expire too — acceptance alone doesn't extend the 24h window.
    const rows = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
    const stale = rows.filter(r => {
      const status = String(r.status ?? "pending")
      const expiresAt = String(r.expires_at ?? r.expiresAt ?? "")
      return (status === "pending" || status === "accepted") && expiresAt && expiresAt < nowIso
    })
    for (const row of stale) {
      const id = String(row.id)
      await AdminService.updateDoc("offers", id, { status: "expired" }).catch(() => {})
      await syncOfferToChatMessages(
        id,
        row.chat_id ? String(row.chat_id) : (row as any).chatId,
        "expired",
      ).catch(() => {})
    }
    return { expiredCount: stale.length }
  },

  async deleteExpiredOffers() {
    const rows = (await AdminService.getCollection("offers")) as Record<string, unknown>[]
    const expired = rows.filter(r => String(r.status ?? "") === "expired")
    for (const row of expired) {
      await AdminService.deleteDoc("offers", String(row.id)).catch(() => {})
    }
    return { deletedCount: expired.length }
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
