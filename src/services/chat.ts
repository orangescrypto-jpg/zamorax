// src/services/chat.ts
// WAS FIREBASE → NOW CLOUDFLARE D1 (poll every 4-5s for chat realtime)
import type { Chat, ChatMessage } from "@/src/types"
export { ChatService } from "@/src/services/providers/cloudflare/chat"
export interface IChatService {
  getChatById(chatId: string): Promise<Chat | null>
  getUserChats(userId: string): Promise<Chat[]>
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
