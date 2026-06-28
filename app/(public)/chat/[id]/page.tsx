"use client"
// app/(public)/chat/[id]/page.tsx
// Full-screen WhatsApp-style layout — fills viewport, messages stick to bottom

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
      if (!data.participants.includes(uid)) { router.push("/unauthorized"); return }
      setChat(data)
      setLoading(false)
    })
    return unsub
  }, [params.id, uid, router])

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
  if (!chat) return null

  const isSeller  = chat.sellerId === uid
  const otherName = isSeller
    ? (chat.buyerName  || chat.participantNames?.[chat.buyerId  ?? ""] || "Buyer")
    : (chat.sellerName || chat.participantNames?.[chat.sellerId ?? ""] || "Seller")

  return (
    // FIX: full viewport height, no padding, so ChatWindow can own the scroll
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {chat.listingTitle && (
        <div className="px-4 py-1.5 bg-muted/60 border-b text-xs text-muted-foreground shrink-0">
          <span className="text-primary font-medium">Re:</span> {chat.listingTitle}
        </div>
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
