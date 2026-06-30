"use client"
// app/(public)/chat/[id]/page.tsx
// Full-screen WhatsApp-style layout — fills viewport, messages stick to bottom

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuthStore } from "@/store/authStore"
import { ChatService } from "@/src/services/chat"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { Loader2, ChevronRight } from "lucide-react"
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
        <Link
          href={chat.listingId ? `/listings/${chat.listingId}` : "#"}
          className="flex items-center gap-3 px-3 py-2 bg-muted/60 border-b shrink-0 hover:bg-muted/80 transition-colors"
        >
          {chat.listingImage ? (
            <div className="relative h-10 w-10 rounded-md overflow-hidden shrink-0 border bg-background">
              <Image src={chat.listingImage} alt={chat.listingTitle} fill className="object-cover" sizes="40px" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-md shrink-0 border bg-background" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-primary font-medium leading-none mb-0.5">Re: this listing</p>
            <p className="text-xs font-medium text-foreground truncate">{chat.listingTitle}</p>
          </div>
          {chat.listingId && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </Link>
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
