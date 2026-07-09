"use client"

import { AdminService, query, orderBy, onSnapshot, where, ChatService } from "@/src/services"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter, useSearchParams } from "next/navigation"
import { MessageSquare, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function ChatListPage() {
  const { user }        = useAuth()
  const router           = useRouter()
  const searchParams     = useSearchParams()
  const [chats,   setChats]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Message Seller from a store page (/chat?sellerId=X) has no listing
  // context of its own, so it used to just render this empty chat list
  // and leave the buyer stranded with nothing to click. Now: if a thread
  // with this seller already exists, jump straight into it (no duplicate
  // conversation is created — getOrCreateChat already dedupes on
  // buyer_id+seller_id). If not, start one using the seller's most recent
  // active listing as the reference item, same as clicking "Chat with
  // Seller" from a listing page would.
  const sellerIdParam = searchParams.get("sellerId")

  useEffect(() => {
    if (!user?.uid || !sellerIdParam) return
    if (user.uid === sellerIdParam) return

    let cancelled = false
    const go = async () => {
      try {
        const existing = await AdminService.getCollection("chats", [
          { field: "buyer_id",  op: "==", value: user.uid       } as any,
          { field: "seller_id", op: "==", value: sellerIdParam  } as any,
          { limit: 1 }                                            as any,
        ]) as Record<string, unknown>[]

        if (existing.length > 0) {
          if (!cancelled) router.replace(`/chat/${existing[0].id}`)
          return
        }

        // No prior conversation — start one. Pull the seller's most recent
        // active listing to attach, so the chat has a real item to reference.
        const [sellerRes, listingsRes] = await Promise.all([
          fetch(`/api/seller/${sellerIdParam}`),
          fetch(`/api/listings?sellerId=${sellerIdParam}&limit=1`),
        ])
        const seller   = sellerRes.ok ? await sellerRes.json() : null
        const listingsJson = listingsRes.ok ? await listingsRes.json() : { items: [] }
        const listing   = (listingsJson.items ?? [])[0] ?? null

        if (!seller) { if (!cancelled) setLoading(false); return }

        const chat = await ChatService.getOrCreateChat({
          listingId:    listing?.id ?? sellerIdParam,
          listingTitle: listing?.title ?? seller.storeName ?? seller.fullName ?? "Store",
          listingImage: listing?.images?.[0] ?? null,
          buyerId:      user.uid,
          buyerName:    user.fullName || user.email || "Buyer",
          sellerId:     sellerIdParam,
          sellerName:   seller.storeName ?? seller.fullName ?? "Seller",
        })
        if (!cancelled) router.replace(`/chat/${chat.id}`)
      } catch {
        if (!cancelled) setLoading(false)
      }
    }
    go()
    return () => { cancelled = true }
  }, [user?.uid, sellerIdParam, router])

  useEffect(() => {
    if (!user?.uid || sellerIdParam) return
    const q = AdminService._ref_("chats", [
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc"),
    ])
    return onSnapshot(q, docs => {
      setChats(docs.docs.map((d: any) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [user?.uid, sellerIdParam])

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
