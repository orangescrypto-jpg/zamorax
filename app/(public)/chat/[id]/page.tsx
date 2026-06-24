"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { ChatService } from "@/src/services/chat"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { Loader2 } from "lucide-react"
import type { Chat } from "@/src/types"

export default function ChatPage() {
  const params  = useParams()
  const router  = useRouter()
  const uid     = useAuthStore(s => s.user?.uid)
  const [chat,    setChat]    = useState<Chat | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id || !uid) return

    const unsub = ChatService.subscribeToChat(params.id as string, data => {
      if (!data) { router.push("/listings"); return }

      // Security: only participants can access this chat
      if (!data.participants.includes(uid)) {
        router.push("/unauthorized")
        return
      }

      setChat(data)
      setLoading(false)
    })

    return unsub
  }, [params.id, uid, router])

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
  if (!chat) return null

  // Derive the other person's display name from stored fields
  const isSeller   = chat.sellerId === uid
  const otherName  = isSeller
    ? (chat.buyerName  || chat.participantNames?.[chat.buyerId  ?? ""] || "Buyer")
    : (chat.sellerName || chat.participantNames?.[chat.sellerId ?? ""] || "Seller")

  return (
    <div className="container py-8 max-w-3xl">
      {chat.listingTitle && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <span className="text-primary font-medium">Re:</span> {chat.listingTitle}
        </p>
      )}
      <ChatWindow
        chatId={chat.id}
        userId={uid!}
        receiverName={otherName}
        chat={chat}
      />
    </div>
  )
}
