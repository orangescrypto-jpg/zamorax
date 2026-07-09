// hooks/useSellerInboxCounts.ts
// Neither the seller nor buyer dashboard had any way to see a new chat
// message or a new/countered offer came in without clicking into
// Chat / Offers first — no badge anywhere. This polls both counts so
// each role's layout can show them next to "Chat"/"Messages" and
// "Offers Inbox"/"Offers" in the nav.
"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { ChatService } from "@/src/services/chat"
import { AdminService } from "@/src/services"

const POLL_MS = 20_000

export function useSellerInboxCounts() {
  return useInboxCounts("seller")
}

export function useBuyerInboxCounts() {
  return useInboxCounts("buyer")
}

function useInboxCounts(role: "seller" | "buyer") {
  const { user } = useAuth()
  const [unreadChats, setUnreadChats]     = useState(0)
  const [pendingOffers, setPendingOffers] = useState(0)

  useEffect(() => {
    if (!user?.uid) return
    let active = true

    const load = async () => {
      try {
        const offerField = role === "seller" ? "seller_id" : "buyer_id"
        // Sellers care about offers awaiting THEIR response (pending).
        // Buyers care about offers awaiting THEIR response — a counter
        // the seller sent back, which needs the buyer to accept/decline.
        const offerStatus = role === "seller" ? "pending" : "countered"

        const [chatCount, offerRows] = await Promise.all([
          ChatService.getUnreadChatCount(user.uid),
          AdminService.getCollection("offers", [
            { field: offerField, op: "==", value: user.uid } as any,
            { field: "status",   op: "==", value: offerStatus } as any,
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
  }, [user?.uid, role])

  return { unreadChats, pendingOffers }
}
