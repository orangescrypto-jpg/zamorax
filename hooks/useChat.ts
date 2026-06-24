"use client"
// hooks/useChat.ts
// Uses ChatService instead of calling Firebase directly.

import { useEffect, useState, useCallback } from "react"
import { ChatService } from "@/src/services/chat"
import type { ChatMessage } from "@/src/types"

export function useChat(chatId: string, currentUserId: string) {
  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [loading,      setLoading]      = useState(true)
  const [escrowFunded, setEscrowFunded] = useState(false)

  useEffect(() => {
    if (!chatId) return

    // Subscribe to chat doc for lock/escrow status
    const unsubChat = ChatService.subscribeToChat(chatId, chat => {
      setEscrowFunded(chat ? chat.isLocked === false : false)
    })

    // Subscribe to real-time messages
    const unsubMessages = ChatService.subscribeToMessages(chatId, msgs => {
      setMessages(msgs)
      setLoading(false)
    })

    return () => {
      unsubChat()
      unsubMessages()
    }
  }, [chatId])

  const sendMessage = useCallback(
    async (text: string) => {
      await ChatService.sendMessage(chatId, currentUserId, text)
    },
    [chatId, currentUserId],
  )

  return { messages, loading, sendMessage, escrowFunded }
}
