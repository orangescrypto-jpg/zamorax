"use client"

import {AdminService, onSnapshot} from "@/src/services"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { ChatWindow } from "@/components/chat/ChatWindow"
import { Loader2 } from "lucide-react"

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const uid = useAuthStore(s => s.user?.uid)
  const [chatData, setChatData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!params.id || !uid) return
    const unsub = AdminService.subscribeToDoc("chats", params.id as string, snap => {
      if (!snap.exists()) { router.push("/listings"); return }
      const data = snap.data()
      // Security: Only buyer/seller of this chat can access
      if (data.buyerId !== uid && data.sellerId !== uid) { router.push("/unauthorized"); return }
      setChatData({ id: snap.id, ...data })
      setLoading(false)
    })
    return unsub
  }, [params.id, uid, router])

  if (loading) return <div className="container flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!chatData) return null

  const isSeller = chatData.sellerId === uid
  const otherName = isSeller ? chatData.buyerName : chatData.sellerName

  return (
    <div className="container py-8 max-w-3xl">
      <ChatWindow chatId={chatData.id} userId={uid!} receiverName={otherName} />
    </div>
  )
}
