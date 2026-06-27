// lib/realtime/useSupabaseRealtime.ts  — NEW FILE
// Supabase Realtime subscription with automatic reconnection.
// Covers: listings, orders, chats/messages, notifications, disputes.
"use client"

import { useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

export type RealtimeTable =
  | "listings"
  | "orders"
  | "chats"
  | "messages"
  | "notifications"
  | "disputes"

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*"

interface SubscribeOptions {
  table:   RealtimeTable
  event?:  RealtimeEvent
  filter?: string          // e.g. "user_id=eq.abc123"
  schema?: string
  onData:  (payload: any) => void
}

/**
 * Subscribe to a Supabase Realtime table.
 * Automatically reconnects if the session drops.
 *
 * @example
 * useSupabaseRealtime({
 *   table: "notifications",
 *   filter: `user_id=eq.${uid}`,
 *   onData: (payload) => addNotification(payload.new),
 * })
 */
export function useSupabaseRealtime({
  table,
  event  = "*",
  filter,
  schema = "public",
  onData,
}: SubscribeOptions) {
  const channelRef  = useRef<RealtimeChannel | null>(null)
  const onDataRef   = useRef(onData)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the callback ref fresh without resubscribing
  useEffect(() => { onDataRef.current = onData }, [onData])

  const subscribe = useCallback(() => {
    const supabase = createClient()

    const channelName = filter
      ? `${table}:${filter}`
      : `${table}:${event}`

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        { event, schema, table, filter },
        (payload: any) => { onDataRef.current(payload) },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // Clear any pending reconnect timer
          if (reconnectRef.current) clearTimeout(reconnectRef.current)
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[Realtime] ${table} channel error (${status}). Reconnecting in 3s…`)
          channelRef.current = null
          reconnectRef.current = setTimeout(() => subscribe(), 3000)
        }

        if (status === "CLOSED") {
          // Only reconnect if we didn't close intentionally (unmount clears the ref first)
          if (channelRef.current) {
            reconnectRef.current = setTimeout(() => subscribe(), 3000)
          }
        }
      })

    channelRef.current = channel
    return channel
  }, [table, event, schema, filter])

  useEffect(() => {
    const supabase = createClient()
    subscribe()

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [subscribe])
}

/**
 * Subscribe to multiple tables at once.
 */
export function useRealtimeMulti(subscriptions: SubscribeOptions[]) {
  subscriptions.forEach((opts) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSupabaseRealtime(opts)
  })
}
