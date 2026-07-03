// lib/supabase/mirrorMessage.ts
// Server-side helper: mirror a chat message row into Supabase so Postgres
// Changes fires an INSERT event for realtime subscribers.
//
// D1 remains the source of truth for message content. This table exists
// purely to trigger realtime — it is NOT read for anything except by the
// Postgres Changes subscription itself, which reacts to the INSERT event
// and then refetches the real message from D1.
//
// This replaces the previous Broadcast-based realtime (lib/supabase/broadcast.ts),
// which could silently drop events if no client happened to be subscribed
// at the exact moment of the send. Postgres Changes is driven by an actual
// row insert, so there's nothing to "miss" — a client that subscribes even
// a moment late will still see the row via its own catch-up query.
//
// Run supabase-realtime-setup.sql once before using this.

import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !svcKey) throw new Error("Supabase env vars not set")
  return createClient(url, svcKey)
}

export async function mirrorMessage(params: {
  id: string
  chatId: string
  senderId: string
  content: string
}): Promise<void> {
  try {
    const supabase = getAdminClient()
    const { error } = await supabase.from("chat_messages_mirror").insert({
      id:         params.id,
      chat_id:    params.chatId,
      sender_id:  params.senderId,
      content:    params.content,
    })
    if (error) {
      console.error(`[mirrorMessage] insert failed for chat ${params.chatId}:`, error.message)
    }
  } catch (err: any) {
    // Non-fatal — D1 write already succeeded, this only affects realtime push.
    console.error(`[mirrorMessage] failed for chat ${params.chatId}:`, err?.message ?? err)
  }
}
