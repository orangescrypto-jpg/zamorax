// app/api/chat/mirror-message/route.ts
// POST — mirrors a chat message that was just written to D1 into the
// Supabase chat_messages_mirror table, so Postgres Changes fires an
// INSERT event for realtime subscribers (see useChatPostgresChanges).
//
// Called from src/services/providers/cloudflare/chat.ts right after each
// D1 message write. Uses the service-role key, so this MUST stay a
// server route — never call mirrorMessage() directly from client code.
import { NextResponse, type NextRequest } from "next/server"
import { mirrorMessage } from "@/lib/supabase/mirrorMessage"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.id || !body?.chatId || !body?.senderId || typeof body?.content !== "string") {
    return NextResponse.json({ error: "Missing id, chatId, senderId, or content" }, { status: 400 })
  }

  await mirrorMessage({
    id:       String(body.id),
    chatId:   String(body.chatId),
    senderId: String(body.senderId),
    content:  String(body.content),
  })

  // Always 200 — mirroring is best-effort and must never surface as a
  // user-facing failure for the actual message send, which already
  // succeeded in D1 before this route was ever called.
  return NextResponse.json({ ok: true })
}
