"use client"

import { AdminService, query, orderBy, onSnapshot, where } from "@/src/services"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { MessageSquare, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function ChatListPage() {
  const { user } = useAuth()
  const router   = useRouter()
  const [chats,   setChats]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const q = AdminService._ref_("chats", [
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc"),
    ])
    return onSnapshot(q, docs => {
      setChats(docs.docs.map((d: any) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [user?.uid])

  if (loading) return (
    <div className="flex h-60 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <main className="container max-w-lg py-6 pb-24 space-y-4">
      <h1 className="text-xl font-bold">Messages</h1>

      {chats.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <MessageSquare className="h-14 w-14 text-muted-foreground/30" />
          <p className="font-semibold text-secondary">No messages yet</p>
          <p className="text-sm text-muted-foreground">
            When you contact a seller, your chats will appear here.
          </p>
        </div>
      )}

      {chats.map(chat => {
        // Derive the other person's name using the stored fields
        const isSeller  = chat.sellerId === user?.uid
        const otherName = isSeller
          ? (chat.buyerName  || chat.participantNames?.[chat.buyerId]  || "Buyer")
          : (chat.sellerName || chat.participantNames?.[chat.sellerId] || "Seller")

        const lastMsg = chat.lastMessage || "No messages yet"
        const time    = chat.lastMessageAt?.toDate
          ? formatDistanceToNow(chat.lastMessageAt.toDate(), { addSuffix: true })
          : ""

        return (
          <div
            key={chat.id}
            onClick={() => router.push(`/chat/${chat.id}`)}
            className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:border-primary transition"
          >
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
              {otherName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{otherName}</p>
                <span className="text-xs text-muted-foreground">{time}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{lastMsg}</p>
              {chat.listingTitle && (
                <p className="text-xs text-primary truncate">Re: {chat.listingTitle}</p>
              )}
            </div>
          </div>
        )
      })}
    </main>
  )
}
