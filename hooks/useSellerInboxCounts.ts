// hooks/useSellerInboxCounts.ts
// The seller dashboard had no way to see a new chat message or a new offer
// came in without clicking into Chat / Offers Inbox first — no badge
// anywhere. This polls both counts so the layout can show them next to
// "Chat" and "Offers Inbox" in the nav.
"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { ChatService } from "@/src/services/chat"
import { AdminService } from "@/src/services"

const POLL_MS = 20_000

export function useSellerInboxCounts() {
  const { user } = useAuth()
  const [unreadChats, setUnreadChats]     = useState(0)
  const [pendingOffers, setPendingOffers] = useState(0)

  useEffect(() => {
    if (!user?.uid) return
    let active = true

    const load = async () => {
      try {
        const [chatCount, offerRows] = await Promise.all([
          ChatService.getUnreadChatCount(user.uid),
          AdminService.getCollection("offers", [
            { field: "seller_id", op: "==", value: user.uid } as any,
            { field: "status",    op: "==", value: "pending" } as any,
            { limit: 200 } as any,
          ]),
        ])
        if (!active) return
        setUnreadChats(chatCount)
        setPendingOffers((offerRows as unknown[]).length)
      } catch { /* keep previous counts on transient errors */ }
    }

    load()
    const interval = setInterval(load, POLL_MS)
    return () => { active = false; clearInterval(interval) }
  }, [user?.uid])

  return { unreadChats, pendingOffers }
}
