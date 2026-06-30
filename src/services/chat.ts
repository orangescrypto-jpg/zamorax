// src/services/chat.ts
// WAS FIREBASE → NOW CLOUDFLARE D1 (poll every 4-5s for chat realtime)
import type { Chat, ChatMessage } from "@/src/types"
export { ChatService } from "@/src/services/providers/cloudflare/chat"
export interface IChatService {
  getChatById(chatId: string): Promise<Chat | null>
  getUserChats(userId: string): Promise<Chat[]>
  // Single enforced entry point for chat creation. listingId is REQUIRED —
  // there is no such thing as a chat without a listing going forward.
  // Finds the existing buyer<->seller<->listing chat if one exists
  // (backfilling listing fields if they were missing), otherwise creates it.
  getOrCreateChat(params: {
    listingId: string
    listingTitle: string
    listingImage?: string | null
    buyerId: string
    buyerName: string
    sellerId: string
    sellerName: string
  }): Promise<Chat>
  sendMessage(chatId: string, senderId: string, text: string): Promise<void>
  sendOfferMessage(chatId: string, senderId: string, payload: {
    offerAmount: number; originalPrice: number; listingId: string
    listingTitle: string; listingImage?: string; buyerId: string
    buyerName: string; sellerId: string; sellerName: string
  }): Promise<{ offerId: string }>
  acceptChatOffer(chatId: string, messageId: string, offerId: string, offerAmount: number, offerData: {
    listingId: string; listingTitle: string; buyerId: string; sellerId: string; originalPrice: number
  }): Promise<void>
  declineChatOffer(chatId: string, messageId: string, offerId: string): Promise<void>
  subscribeToMessages(chatId: string, callback: (messages: ChatMessage[]) => void): () => void
  subscribeToChat(chatId: string, callback: (chat: Chat | null) => void): () => void
}
