// lib/realtime/useChatPostgresChanges.ts
// Subscribe to Postgres Changes INSERT events on chat_messages_mirror for
// one chat. Fires onNewMessage() whenever a row lands for this chat_id —
// callers should refetch the real message list from D1 in that callback.
//
// This is the Postgres Changes replacement for useSupabaseRealtime's
// Broadcast-based subscription. Prefer this for chat; it does not depend
// on precise subscribe/send timing the way Broadcast does.
"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

export function useChatPostgresChanges(chatId: string | null | undefined, onNewMessage: () => void) {
  const callbackRef = useRef(onNewMessage)
  useEffect(() => { callbackRef.current = onNewMessage }, [onNewMessage])

  useEffect(() => {
    if (!chatId) return

    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    channel = supabase
      .channel(`chat-pg:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages_mirror", filter: `chat_id=eq.${chatId}` },
        () => { callbackRef.current() },
      )
      .subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [chatId])
}
