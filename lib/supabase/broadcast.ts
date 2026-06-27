// lib/supabase/broadcast.ts
// Server-side helper to send Supabase Realtime Broadcast events.
// Call this after any D1 write that clients need to react to in real time.
// No tables needed in Supabase — Broadcast is a pure message bus.
//
// Usage:
//   await broadcast("chat:abc123", "new_message", { chatId: "abc123" })
//   await broadcast("orders:uid123", "order_updated", { orderId, status })
//   await broadcast("notifications:uid123", "new_notification", { userId })

import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !svcKey) throw new Error("Supabase env vars not set")
  return createClient(url, svcKey)
}

export async function broadcast(
  channel: string,
  event:   string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = getAdminClient()
    const ch = supabase.channel(channel)
    await ch.send({ type: "broadcast", event, payload })
    await supabase.removeChannel(ch)
  } catch (err: any) {
    // Non-fatal — D1 write already succeeded. Log and continue.
    console.error(`[broadcast] ${channel}/${event} failed:`, err.message)
  }
}
