// src/services/providers/cloudflare/chat.ts
// Data lives in Cloudflare D1.
// Realtime: Supabase Broadcast (no tables needed in Supabase).
// After every D1 write, we broadcast an event on channel "chat:<chatId>".
// Clients subscribe via useSupabaseRealtime and refetch from D1 on event.
import { AdminService } from "@/src/services/admin"
import type { IChatService } from "@/src/services/chat"
import type { Chat, ChatMessage, ChatOfferData } from "@/src/types"
import { getPlatformSettings } from "@/src/services/platformSettings"

const PHONE_REGEX = /(\+?\d{10,14}|0\d{10})|((whatsapp|wa\.me|telegram|phone|call)[\s:].+)/i

function parseJson(v: unknown): any {
  try { return v ? JSON.parse(v as string) : undefined } catch { return undefined }
}

function mapMessageRow(row: Record<string, unknown>): ChatMessage {
  return {
    id:        String(row.id),
    senderId:  String(row.sender_id ?? row.senderId ?? ""),
    text:      String(row.text ?? ""),
    isBlocked: !!row.is_blocked,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    type:      String(row.type ?? "text") as "text" | "offer",
    offerData: parseJson(row.offer_data) as ChatOfferData | undefined,
  }
}

function mapChatRow(row: Record<string, unknown>): Chat {
  return {
    id:               String(row.id),
    participants:     parseJson(row.participants) ?? [],
    participantNames: parseJson(row.participant_names) ?? {},
    buyerId:          String(row.buyer_id   ?? row.buyerId   ?? ""),
    sellerId:         String(row.seller_id  ?? row.sellerId  ?? ""),
    buyerName:        row.buyer_name  ? String(row.buyer_name)  : undefined,
    sellerName:       row.seller_name ? String(row.seller_name) : undefined,
    listingId:        row.listing_id  ? String(row.listing_id)  : undefined,
    listingTitle:     row.listing_title ? String(row.listing_title) : undefined,
    listingImage:     row.listing_image ? String(row.listing_image) : undefined,
    orderId:          row.order_id    ? String(row.order_id)    : undefined,
    isLocked:         row.is_locked !== undefined ? !!row.is_locked : true,
    lastMessage:      row.last_message    ? String(row.last_message)    : undefined,
    lastMessageAt:    row.last_message_at ? String(row.last_message_at) : undefined,
    createdAt:        String(row.created_at ?? new Date().toISOString()),
  } as Chat
}

// ── Server-side broadcast (only runs in API routes / server actions) ──────────
async function broadcastChatEvent(chatId: string, event: string, payload: Record<string, unknown> = {}) {
  if (typeof window !== "undefined") return // client-side guard
  try {
    const { broadcast } = await import("@/lib/supabase/broadcast")
    await broadcast(`chat:${chatId}`, event, { chatId, ...payload })
  } catch { /* non-fatal */ }
}

export const ChatService: IChatService = {

  async getChatById(chatId) {
    const row = await AdminService.getDoc("chats", chatId)
    if (!row) return null
    return mapChatRow(row as Record<string, unknown>)
  },

  async getUserChats(userId) {
    const all = (await AdminService.getCollection("chats")) as Record<string, unknown>[]
    return all
      .filter(r => (parseJson(r.participants) as string[] ?? []).includes(userId))
      .sort((a: any, b: any) =>
        new Date(String(b.last_message_at ?? b.created_at ?? 0)).getTime() -
        new Date(String(a.last_message_at ?? a.created_at ?? 0)).getTime()
      )
      .slice(0, 50)
      .map(mapChatRow)
  },

  async sendMessage(chatId, senderId, text) {
    if (!chatId || !senderId || !text.trim()) return

    const settings = await getPlatformSettings()
    if (settings.chatEscrowLockEnabled) {
      const chat = await AdminService.getDoc("chats", chatId) as Record<string, unknown> | null
      if (chat?.is_locked && PHONE_REGEX.test(text)) {
        throw new Error("Contact details are hidden until escrow is funded.")
      }
    }

    await AdminService.addDoc("messages", {
      chat_id:    chatId,
      sender_id:  senderId,
      text:       text.trim(),
      is_blocked: false,
      type:       "text",
    })

    await AdminService.updateDoc("chats", chatId, {
      last_message:    text.trim().slice(0, 100),
      last_message_at: new Date().toISOString(),
    })

    // Notify both participants to refetch messages from D1
    await broadcastChatEvent(chatId, "new_message", { senderId })
  },

  async sendOfferMessage(chatId, senderId, payload) {
    const { offerAmount, originalPrice, listingId, listingTitle, listingImage,
            buyerId, buyerName, sellerId, sellerName } = payload

    const offerRef = await AdminService.addDoc("offers", {
      listing_id:     listingId,
      listing_title:  listingTitle,
      listing_image:  listingImage ?? "",
      original_price: originalPrice,
      offer_amount:   offerAmount,
      buyer_id:       buyerId,
      buyer_name:     buyerName,
      seller_id:      sellerId,
      seller_name:    sellerName,
      chat_id:        chatId,
      status:         "pending",
      expires_at:     new Date(Date.now() + 86400000).toISOString(),
    })

    const offerData: ChatOfferData = {
      offerId: offerRef.id, offerAmount, originalPrice, listingTitle, listingId, status: "pending",
    }

    const label = `₦${(offerAmount / 100).toLocaleString("en-NG")} offer for ${listingTitle}`
    await AdminService.addDoc("messages", {
      chat_id:    chatId,
      sender_id:  senderId,
      text:       label,
      type:       "offer",
      offer_data: JSON.stringify(offerData),
      is_blocked: false,
    })

    await AdminService.updateDoc("chats", chatId, {
      last_message:    `Offer: ${label}`,
      last_message_at: new Date().toISOString(),
    })

    await broadcastChatEvent(chatId, "new_message", { senderId, type: "offer" })

    return { offerId: offerRef.id }
  },

  async acceptChatOffer(chatId, messageId, offerId, offerAmount, offerData) {
    await AdminService.updateDoc("offers", offerId, { status: "accepted", responded_at: new Date().toISOString() })

    const docId = `${offerData.listingId}_${offerData.buyerId}`
    await AdminService.setDoc("accepted_offers", docId, {
      offer_id:       offerId,
      listing_id:     offerData.listingId,
      listing_title:  offerData.listingTitle,
      buyer_id:       offerData.buyerId,
      seller_id:      offerData.sellerId,
      agreed_price:   offerAmount,
      original_price: offerData.originalPrice,
      status:         "active",
      accepted_at:    new Date().toISOString(),
    })

    const msg = await AdminService.getDoc("messages", messageId) as Record<string, unknown> | null
    if (msg) {
      const od = parseJson(msg.offer_data) ?? {}
      od.status = "accepted"
      await AdminService.updateDoc("messages", messageId, { offer_data: JSON.stringify(od) })
    }

    await broadcastChatEvent(chatId, "new_message", { offerId, offerStatus: "accepted" })
  },

  async declineChatOffer(chatId, messageId, offerId) {
    await AdminService.updateDoc("offers", offerId, { status: "declined", responded_at: new Date().toISOString() })

    const msg = await AdminService.getDoc("messages", messageId) as Record<string, unknown> | null
    if (msg) {
      const od = parseJson(msg.offer_data) ?? {}
      od.status = "declined"
      await AdminService.updateDoc("messages", messageId, { offer_data: JSON.stringify(od) })
    }

    await broadcastChatEvent(chatId, "new_message", { offerId, offerStatus: "declined" })
  },

  // ── subscribeToMessages ───────────────────────────────────────────────────
  // Returns an initial fetch + an unsubscribe function.
  // The UI layer should call useSupabaseRealtime({ channel: `chat:${chatId}`,
  // event: "new_message", onEvent: () => refetchMessages() }) alongside this.
  subscribeToMessages(chatId, callback) {
    let active = true

    const fetchAll = async () => {
      if (!active) return
      try {
        const all = (await AdminService.getCollection("messages")) as Record<string, unknown>[]
        const msgs = all
          .filter(r => String(r.chat_id ?? r.chatId) === chatId)
          .sort((a: any, b: any) =>
            new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime()
          )
          .slice(-200)
          .map(mapMessageRow)
        callback(msgs)
      } catch { /* ignore */ }
    }

    fetchAll()
    return () => { active = false }
  },

  subscribeToChat(chatId, callback) {
    let active = true

    const fetch = async () => {
      if (!active) return
      try {
        const row = await AdminService.getDoc("chats", chatId)
        callback(row ? mapChatRow(row as Record<string, unknown>) : null)
      } catch { /* ignore */ }
    }

    fetch()
    return () => { active = false }
  },
}
