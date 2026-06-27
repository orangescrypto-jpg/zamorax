// lib/realtime/useSupabaseRealtime.ts
// Supabase Realtime via Broadcast — no tables needed in Supabase.
// The server sends a broadcast event after each D1 write; the client
// receives it here and triggers a refetch from D1.
//
// Channel naming convention (must match server-side broadcast.ts calls):
//   chat:<chatId>              → new_message
//   orders:<userId>            → order_updated
//   notifications:<userId>     → new_notification
//   disputes:<orderId>         → dispute_updated
//   listings:<listingId>       → listing_updated
"use client"

import { useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface BroadcastOptions {
  /** Channel name, e.g. "chat:abc123" or "notifications:uid456" */
  channel: string
  /** Broadcast event name to listen for, e.g. "new_message" */
  event: string
  /** Called with the broadcast payload when the event fires */
  onEvent: (payload: Record<string, unknown>) => void
}

/**
 * Subscribe to a Supabase Realtime Broadcast channel.
 * Automatically reconnects on disconnect.
 *
 * @example
 * // Listen for new messages in a chat
 * useSupabaseRealtime({
 *   channel: `chat:${chatId}`,
 *   event: "new_message",
 *   onEvent: () => refetchMessages(),
 * })
 *
 * @example
 * // Listen for notifications
 * useSupabaseRealtime({
 *   channel: `notifications:${uid}`,
 *   event: "new_notification",
 *   onEvent: () => refetchNotifications(),
 * })
 */
export function useSupabaseRealtime({ channel, event, onEvent }: BroadcastOptions) {
  const channelRef   = useRef<RealtimeChannel | null>(null)
  const onEventRef   = useRef(onEvent)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep callback ref fresh without resubscribing
  useEffect(() => { onEventRef.current = onEvent }, [onEvent])

  const subscribe = useCallback(() => {
    const supabase = createClient()

    const ch = supabase
      .channel(channel)
      .on("broadcast", { event }, (msg: any) => {
        onEventRef.current(msg.payload ?? {})
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          if (reconnectRef.current) clearTimeout(reconnectRef.current)
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[Realtime] ${channel} error (${status}). Reconnecting in 3s…`)
          channelRef.current = null
          reconnectRef.current = setTimeout(() => subscribe(), 3000)
        }

        if (status === "CLOSED" && channelRef.current) {
          reconnectRef.current = setTimeout(() => subscribe(), 3000)
        }
      })

    channelRef.current = ch
  }, [channel, event])

  useEffect(() => {
    subscribe()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      const supabase = createClient()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [subscribe])
}

/**
 * Subscribe to multiple broadcast channels at once.
 *
 * @example
 * useRealtimeMulti([
 *   { channel: `chat:${chatId}`, event: "new_message", onEvent: refetchMessages },
 *   { channel: `notifications:${uid}`, event: "new_notification", onEvent: refetchNotifications },
 * ])
 */
export function useRealtimeMulti(subscriptions: BroadcastOptions[]) {
  subscriptions.forEach((opts) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSupabaseRealtime(opts)
  })
}
