"use client"
// hooks/useChat.ts
// Uses ChatService instead of calling Firebase directly.
// Realtime: Supabase Broadcast fires a "new_message" event on channel
// "chat:<chatId>" after every D1 write (see src/services/providers/cloudflare/chat.ts).
// We listen for it here and refetch from D1 — no polling interval needed.

import { useEffect, useState, useCallback, useRef } from "react"
import { ChatService } from "@/src/services/chat"
import { useSupabaseRealtime } from "@/lib/realtime/useSupabaseRealtime"
import type { ChatMessage } from "@/src/types"

export function useChat(chatId: string, currentUserId: string) {
  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [loading,      setLoading]      = useState(true)
  const [escrowFunded, setEscrowFunded] = useState(false)

  const refetchMessagesRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!chatId) return
    setLoading(true)

    // Subscribe to chat doc for lock/escrow status (single fetch)
    const unsubChat = ChatService.subscribeToChat(chatId, chat => {
      setEscrowFunded(chat ? chat.isLocked === false : false)
    })

    // Subscribe to messages (single initial fetch; realtime broadcast
    // below is what keeps this fresh afterward)
    const unsubMessages = ChatService.subscribeToMessages(chatId, msgs => {
      setMessages(msgs)
      setLoading(false)
    })

    // Let the broadcast handler trigger a fresh D1 fetch on demand
    refetchMessagesRef.current = () => {
      ChatService.subscribeToMessages(chatId, msgs => setMessages(msgs))
    }

    return () => {
      unsubChat()
      unsubMessages()
    }
  }, [chatId])

  // Real-time: refetch messages the instant a broadcast fires for this chat.
  // Covers new text messages, new offers, and offer accept/decline updates
  // (all of which call broadcastChatEvent(chatId, "new_message", ...) server-side).
  useSupabaseRealtime({
    channel: `chat:${chatId}`,
    event:   "new_message",
    onEvent: useCallback(() => {
      refetchMessagesRef.current()
    }, []),
  })

  const sendMessage = useCallback(
    async (text: string) => {
      await ChatService.sendMessage(chatId, currentUserId, text)
      // Don't rely solely on the broadcast round-trip — refetch immediately
      // so the sender sees their own message without needing a manual refresh.
      refetchMessagesRef.current()
    },
    [chatId, currentUserId],
  )

  return { messages, loading, sendMessage, escrowFunded }
}
