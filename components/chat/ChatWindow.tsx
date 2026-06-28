import { useRef, useEffect, useState } from "react"
import { useChat } from "@/hooks/useChat"
import { MessageBubble } from "./MessageBubble"
import { ChatLockNotice } from "./ChatLockNotice"
import { SafeMeetModal } from "./SafeMeetModal"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Send, Loader2, Shield, Tag } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { ChatService } from "@/src/services/chat"
import { formatPrice } from "@/lib/utils"
import type { Chat } from "@/src/types"

interface ChatWindowProps {
  chatId: string
  userId: string
  receiverName: string
  /** Full chat document — provides listing/participant context for offer flow */
  chat: Chat
}

export function ChatWindow({ chatId, userId, receiverName, chat }: ChatWindowProps) {
  const { messages, loading, sendMessage, escrowFunded } = useChat(chatId, userId)
  const { settings } = usePlatformSettings()
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [safeMeetOpen, setSafeMeetOpen] = useState(false)

  // Offer modal state
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerAmount, setOfferAmount] = useState("")
  const [sendingOffer, setSendingOffer] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // Is the current user the seller in this chat?
  const isSeller = chat.sellerId === userId

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(input)
      setInput("")
    } catch (err: any) {
      toast({ title: "Message Blocked", description: err.message, variant: "destructive" })
    } finally { setSending(false) }
  }

  // ── Send Offer from chat ─────────────────────────────────────────
  const handleSendOffer = async () => {
    const amountKobo = Math.round(parseFloat(offerAmount || "0") * 100)
    const originalKobo = chat.listingId ? 0 : 0  // we don't always have originalPrice on chat doc
    // Validate
    if (amountKobo <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    if (!chat.listingId || !chat.listingTitle) {
      toast({ title: "No listing linked to this chat", variant: "destructive" })
      return
    }

    setSendingOffer(true)
    try {
      await ChatService.sendOfferMessage(chatId, userId, {
        offerAmount:   amountKobo,
        originalPrice: originalKobo,     // seller's listing price — 0 if unavailable from chat doc
        listingId:     chat.listingId,
        listingTitle:  chat.listingTitle,
        listingImage:  chat.listingImage,
        buyerId:       chat.buyerId ?? userId,
        buyerName:     chat.buyerName ?? "Buyer",
        sellerId:      chat.sellerId ?? "",
        sellerName:    chat.sellerName ?? "Seller",
      })
      toast({ title: "Offer sent 🎉", description: "The seller can accept or decline directly in chat.", variant: "success" })
      setOfferOpen(false)
      setOfferAmount("")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setSendingOffer(false)
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="flex flex-col h-[650px] bg-background border rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
        <h3 className="font-semibold">Chat with {receiverName}</h3>
        <div className="flex items-center gap-2">
          {/* Send Offer button — only shown to the buyer when offer system is enabled */}
          {!isSeller && chat.listingId && settings.offersEnabled && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => setOfferOpen(true)}
            >
              <Tag className="h-3 w-3 mr-1" />
              Send Offer
            </Button>
          )}
          {settings.safeMeetEnabled && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => setSafeMeetOpen(true)}
            >
              <Shield className="h-3 w-3 mr-1" />
              Safe Meet
            </Button>
          )}
          {!escrowFunded && <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded font-medium">Escrow Pending</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/10">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8">No messages yet. Start the conversation!</div>
        )}
        {messages.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.senderId === userId}
            isSeller={isSeller}
            chatId={chatId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {!escrowFunded && <ChatLockNotice />}

      <form onSubmit={handleSend} className="p-3 border-t bg-background flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={!escrowFunded ? "Escrow must be funded to share contact details..." : "Type your message..."}
          className="flex-1 resize-none min-h-[44px] max-h-24"
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
        />
        <Button type="submit" disabled={sending || !input.trim()} className="h-10 w-10 flex items-center justify-center bg-primary hover:bg-primary/90 text-white">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {settings.safeMeetEnabled && (
        <SafeMeetModal
          chatId={chatId}
          userId={userId}
          open={safeMeetOpen}
          onClose={() => setSafeMeetOpen(false)}
        />
      )}

      {/* Send Offer dialog */}
      <Dialog open={offerOpen} onOpenChange={v => { setOfferOpen(v); if (!v) setOfferAmount("") }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Send an Offer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Re: <span className="font-medium text-foreground">{chat.listingTitle}</span>
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Your Offer (₦)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₦</span>
                <Input
                  type="number"
                  value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value)}
                  placeholder="0"
                  className="pl-7"
                  autoFocus
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The seller will see Accept / Decline buttons directly in chat. If accepted, you can Buy Now at this price.
            </p>
            <Button
              className="w-full bg-primary text-white"
              disabled={sendingOffer || !offerAmount || parseFloat(offerAmount) <= 0}
              onClick={handleSendOffer}
            >
              {sendingOffer && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Offer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
