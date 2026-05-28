// src/services/chat.ts
// ─────────────────────────────────────────────────────────────────
// Chat / messaging service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { Chat, ChatMessage } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { ChatService } from "@/src/services/providers/firebase/chat"
// ─────────────────────────────────────────────────────────────────

export interface IChatService {
  getChatById(chatId: string): Promise<Chat | null>
  getUserChats(userId: string): Promise<Chat[]>

  /**
   * Send a message. Enforces contact-masking rule when escrow not funded.
   * Throws if the text contains phone/contact info and escrow is locked.
   */
  sendMessage(chatId: string, senderId: string, text: string): Promise<void>

  /**
   * Subscribe to real-time messages in a chat.
   * Returns unsubscribe function.
   */
  subscribeToMessages(
    chatId: string,
    callback: (messages: ChatMessage[]) => void,
  ): () => void

  /**
   * Subscribe to a single chat document (for lock/escrow status).
   */
  subscribeToChat(
    chatId: string,
    callback: (chat: Chat | null) => void,
  ): () => void
}
