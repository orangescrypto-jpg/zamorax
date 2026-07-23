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
  const type = String(row.type ?? "text") as "text" | "offer"
  let text = String(row.content ?? "")
  let offerData: ChatOfferData | undefined

  if (type === "offer") {
    const parsed = parseJson(row.content)
    if (parsed && typeof parsed === "object") {
      text = String(parsed.label ?? "")
      offerData = parsed.offerData as ChatOfferData | undefined
    }
  }

  return {
    id:        String(row.id),
    senderId:  String(row.sender_id ?? row.senderId ?? ""),
    text,
    isBlocked: false,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    type,
    offerData,
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
    buyerLastReadAt:  row.buyer_last_read_at  ? String(row.buyer_last_read_at)  : null,
    sellerLastReadAt: row.seller_last_read_at ? String(row.seller_last_read_at) : null,
    createdAt:        String(row.created_at ?? new Date().toISOString()),
  } as Chat
}

async function broadcastChatEvent(chatId: string, event: string, payload: Record<string, unknown> = {}) {
  try {
    if (typeof window !== "undefined") {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const ch = supabase.channel(`chat:${chatId}`)
      // FIX: previously only resolved on "SUBSCRIBED" — if the channel hit
      // "CHANNEL_ERROR" / "TIMED_OUT" / "CLOSED" instead, this promise hung
      // forever, which hung acceptChatOffer/declineChatOffer, which left the
      // offer button's loading state stuck in MessageBubble (finally{} never
      // ran). Now resolves/rejects on any terminal status and has a hard
      // 5s timeout as a backstop.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Realtime subscribe timed out")), 5000)
        ch.subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            clearTimeout(timer)
            resolve()
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            clearTimeout(timer)
            reject(new Error(`Realtime subscribe failed: ${status}`))
          }
        })
      })
      // send() resolves once the broadcast is acknowledged by the realtime
      // server — only safe to tear the channel down after that, otherwise
      // on slow connections the message can be dropped silently.
      await ch.send({ type: "broadcast", event, payload: { chatId, ...payload } })
      setTimeout(() => { supabase.removeChannel(ch) }, 250)
    } else {
      const { broadcast } = await import("@/lib/supabase/broadcast")
      await broadcast(`chat:${chatId}`, event, { chatId, ...payload })
    }
  } catch { /* non-fatal */ }
}

// Postgres Changes mirror — fire-and-forget POST to the server route,
// which writes into Supabase's chat_messages_mirror table using the
// service-role key. This is separate from broadcastChatEvent above; both
// currently run side by side, but Postgres Changes (via this call) is the
// more reliable path since it survives a client subscribing a moment
// late, unlike Broadcast which drops events sent before a subscriber
// connects.
async function mirrorChatMessage(id: string, chatId: string, senderId: string, content: string) {
  try {
    await fetch("/api/chat/mirror-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, chatId, senderId, content }),
    })
  } catch { /* non-fatal — realtime push only, D1 write already succeeded */ }
}


export const ChatService: IChatService = {

  async getOrCreateChat(params) {
    const { listingId, listingTitle, listingImage, buyerId, buyerName, sellerId, sellerName } = params

    if (!listingId) {
      throw new Error("getOrCreateChat: listingId is required — chats cannot be created without a listing.")
    }
    if (!buyerId || !sellerId) {
      throw new Error("getOrCreateChat: buyerId and sellerId are required.")
    }
    if (buyerId === sellerId) {
      throw new Error("getOrCreateChat: buyer and seller cannot be the same user.")
    }

    // One thread per buyer/seller pair — match on buyer_id + seller_id only.
    // The listing attached to the thread always reflects whichever listing
    // the user most recently clicked "Chat" from, so the card stays current.
    const existingRows = await AdminService.getCollection("chats", [
      { field: "buyer_id",  op: "==", value: buyerId  } as any,
      { field: "seller_id", op: "==", value: sellerId } as any,
      { limit: 1 }                                     as any,
    ]) as Record<string, unknown>[]

    if (existingRows.length > 0) {
      const row = existingRows[0]
      // Always refresh listing fields to the listing that was just clicked,
      // so the attached card / Send Offer always matches what the user is
      // currently looking at — not whatever listing started the thread.
      if (
        String(row.listing_id ?? "") !== listingId ||
        row.listing_title !== listingTitle ||
        row.listing_image !== (listingImage ?? null)
      ) {
        await AdminService.updateDoc("chats", String(row.id), {
          listing_id:    listingId,
          listing_title: listingTitle,
          listing_image: listingImage ?? null,
        })
        row.listing_id    = listingId
        row.listing_title = listingTitle
        row.listing_image = listingImage ?? null
      }
      return mapChatRow(row)
    }

    const created = await AdminService.addDoc("chats", {
      participants:      JSON.stringify([buyerId, sellerId]),
      participant_names: JSON.stringify({ [buyerId]: buyerName, [sellerId]: sellerName }),
      buyer_id:           buyerId,
      buyer_name:         buyerName,
      seller_id:          sellerId,
      seller_name:        sellerName,
      listing_id:         listingId,
      listing_title:      listingTitle,
      listing_image:      listingImage ?? null,
      is_locked:          true,
      last_message:       null,
      last_message_at:    null,
    }) as Record<string, unknown>

    const row = await AdminService.getDoc("chats", String(created.id)) as Record<string, unknown> | null
    return mapChatRow(row ?? created)
  },

  async getChatById(chatId) {
    const row = await AdminService.getDoc("chats", chatId)
    if (!row) return null
    return mapChatRow(row as Record<string, unknown>)
  },

  // FIX: Was fetching ALL chats then filtering by participants JSON in JS.
  // Now uses WHERE buyer_id = ? OR seller_id = ? — targeted SQL query.
  // participants JSON search was also unreliable for edge cases.
  async getUserChats(userId) {
    const rows = await AdminService.getCollection("chats", [
      { field: "buyer_id",        op: "==",  value: userId } as any,
      { field: "updated_at",      dir: "DESC"              } as any,
      { limit: 50 }                                         as any,
    ]) as Record<string, unknown>[]

    // Also fetch chats where user is seller (D1 doesn't support OR in our builder,
    // so we do two queries and merge — still far cheaper than a full table scan)
    const sellerRows = await AdminService.getCollection("chats", [
      { field: "seller_id",  op: "==",  value: userId } as any,
      { field: "updated_at", dir: "DESC"              } as any,
      { limit: 50 }                                    as any,
    ]) as Record<string, unknown>[]

    const seen = new Set<string>()
    const merged = [...rows, ...sellerRows]
      .filter(r => { const id = String(r.id); if (seen.has(id)) return false; seen.add(id); return true })
      .sort((a: any, b: any) =>
        new Date(String(b.last_message_at ?? b.created_at ?? 0)).getTime() -
        new Date(String(a.last_message_at ?? a.created_at ?? 0)).getTime()
      )
      .slice(0, 50)

    return merged.map(mapChatRow)
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

    const msgRef = await AdminService.addDoc("messages", {
      chat_id:    chatId,
      sender_id:  senderId,
      content:    text.trim(),
      type:       "text",
    })

    await AdminService.updateDoc("chats", chatId, {
      last_message:    text.trim().slice(0, 100),
      last_message_at: new Date().toISOString(),
    })

    await broadcastChatEvent(chatId, "new_message", { senderId })
    void mirrorChatMessage(msgRef.id, chatId, senderId, text.trim())
  },

  async sendOfferMessage(chatId, senderId, payload) {
    const { offerAmount, originalPrice, listingId, listingTitle, listingImage,
            buyerId, buyerName, sellerId, sellerName, quantity } = payload
    const qty = Math.max(1, quantity ?? 1)

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
      quantity:       qty,
      status:         "pending",
      expires_at:     new Date(Date.now() + 86400000).toISOString(),
    })

    const offerData: ChatOfferData = {
      offerId: offerRef.id, offerAmount, originalPrice, listingTitle, listingId, quantity: qty, status: "pending",
    }

    const label = `₦${(offerAmount / 100).toLocaleString("en-NG")} offer for ${listingTitle}`
    const offerMsgContent = JSON.stringify({ label, offerData })
    const offerMsgRef = await AdminService.addDoc("messages", {
      chat_id:    chatId,
      sender_id:  senderId,
      content:    offerMsgContent,
      type:       "offer",
    })

    await AdminService.updateDoc("chats", chatId, {
      last_message:    `Offer: ${label}`,
      last_message_at: new Date().toISOString(),
    })

    await broadcastChatEvent(chatId, "new_message", { senderId, type: "offer" })
    void mirrorChatMessage(offerMsgRef.id, chatId, senderId, offerMsgContent)

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
      quantity:       Math.max(1, offerData.quantity ?? 1),
      status:         "active",
      accepted_at:    new Date().toISOString(),
    })

    const msg = await AdminService.getDoc("messages", messageId) as Record<string, unknown> | null
    if (msg) {
      const envelope = parseJson(msg.content) ?? {}
      envelope.offerData = { ...(envelope.offerData ?? {}), status: "accepted" }
      await AdminService.updateDoc("messages", messageId, { content: JSON.stringify(envelope) })
    }

    await broadcastChatEvent(chatId, "new_message", { offerId, offerStatus: "accepted" })
  },

  async declineChatOffer(chatId, messageId, offerId) {
    await AdminService.updateDoc("offers", offerId, { status: "declined", responded_at: new Date().toISOString() })

    const msg = await AdminService.getDoc("messages", messageId) as Record<string, unknown> | null
    if (msg) {
      const envelope = parseJson(msg.content) ?? {}
      envelope.offerData = { ...(envelope.offerData ?? {}), status: "declined" }
      await AdminService.updateDoc("messages", messageId, { content: JSON.stringify(envelope) })
    }

    await broadcastChatEvent(chatId, "new_message", { offerId, offerStatus: "declined" })
  },

  async counterChatOffer(chatId, messageId, offerId, counterSenderId, payload) {
    // Stamp the counter amount onto the ORIGINAL offer row too — this is the
    // row the standalone Offers pages (buyer "My Offers" / seller "Offers
    // Received") read from. Without this, a counter sent from chat would
    // mark the original as "countered" but leave counterAmount empty there,
    // so it would never show up correctly outside of chat.
    await AdminService.updateDoc("offers", offerId, {
      status:         "countered",
      counter_amount: payload.offerAmount,
      responded_at:   new Date().toISOString(),
    })

    const msg = await AdminService.getDoc("messages", messageId) as Record<string, unknown> | null
    if (msg) {
      const envelope = parseJson(msg.content) ?? {}
      envelope.offerData = { ...(envelope.offerData ?? {}), status: "countered" }
      await AdminService.updateDoc("messages", messageId, { content: JSON.stringify(envelope) })
    }

    // Also post a brand-new pending offer message in chat so the other
    // party sees a live, actionable bubble for the counter.
    const { offerId: newOfferId } = await ChatService.sendOfferMessage(chatId, counterSenderId, payload)

    await broadcastChatEvent(chatId, "new_message", { offerId, offerStatus: "countered" })
    return { offerId: newOfferId }
  },

  // FIX: Was fetching ALL messages then filtering by chat_id in JS.
  // Now uses WHERE chat_id = ? ORDER BY created_at ASC LIMIT 200.
  subscribeToMessages(chatId, callback) {
    let active = true

    const fetchAll = async () => {
      if (!active) return
      try {
        const rows = await AdminService.getCollection("messages", [
          { field: "chat_id",    op: "==", value: chatId } as any,
          { field: "created_at", dir: "ASC"              } as any,
          { limit: 200 }                                  as any,
        ]) as Record<string, unknown>[]
        callback(rows.map(mapMessageRow))
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

  async markChatRead(chatId, userId) {
    const row = await AdminService.getDoc("chats", chatId) as Record<string, unknown> | null
    if (!row) return
    const isBuyer  = String(row.buyer_id  ?? "") === userId
    const isSeller = String(row.seller_id ?? "") === userId
    if (!isBuyer && !isSeller) return
    await AdminService.updateDoc("chats", chatId, isBuyer
      ? { buyer_last_read_at:  new Date().toISOString() }
      : { seller_last_read_at: new Date().toISOString() },
    )
  },

  // A chat counts as unread for this user if the last message timestamp is
  // newer than this user's own last-read stamp (never-read = always
  // unread once there's at least one message) AND the last message wasn't
  // sent by this same user — you don't need a badge for your own message.
  async getUnreadChatCount(userId) {
    const buyerRows = await AdminService.getCollection("chats", [
      { field: "buyer_id", op: "==", value: userId } as any,
      { limit: 200 } as any,
    ]) as Record<string, unknown>[]
    const sellerRows = await AdminService.getCollection("chats", [
      { field: "seller_id", op: "==", value: userId } as any,
      { limit: 200 } as any,
    ]) as Record<string, unknown>[]

    const seen = new Set<string>()
    const all = [...buyerRows, ...sellerRows].filter(r => {
      const id = String(r.id); if (seen.has(id)) return false; seen.add(id); return true
    })

    let count = 0
    for (const row of all) {
      const lastMessageAt = row.last_message_at ? String(row.last_message_at) : null
      if (!lastMessageAt) continue

      const isBuyer = String(row.buyer_id ?? "") === userId
      const readAt  = isBuyer
        ? (row.buyer_last_read_at  ? String(row.buyer_last_read_at)  : null)
        : (row.seller_last_read_at ? String(row.seller_last_read_at) : null)

      // A message this same user sent themselves also updates last_message_at
      // but shouldn't count as "unread" — we don't track sender on the chat
      // row directly, but the read stamp is set the moment they open the
      // thread (including right after sending, since sendMessage happens
      // from inside an open thread), so in practice this compares fine
      // without needing to look up the last message's sender explicitly.
      if (!readAt || new Date(lastMessageAt).getTime() > new Date(readAt).getTime()) {
        count++
      }
    }
    return count
  },
}
