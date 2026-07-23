"use client"

import { cn, formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Tag, Check, X, Loader2, ArrowLeftRight } from "lucide-react"
import { useState } from "react"
import { ChatService } from "@/src/services/chat"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { ChatMessage, Chat } from "@/src/types"

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  /** Present only for offer messages. The chat participant who is the seller. */
  isSeller?: boolean
  chatId?: string
  /** Needed for offer bubbles — supplies buyer/seller ids + names for counter-offers. */
  chat?: Chat
}

// ─── Offer Bubble ─────────────────────────────────────────────────
function OfferBubble({
  message,
  isOwn,
  isSeller,
  chatId,
  chat,
}: MessageBubbleProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<"accept" | "decline" | "counter" | null>(null)
  // Optimistic local override — set immediately on success so the button
  // can't be clicked again while we wait for the parent's message list to
  // refetch/re-render with the server's updated status (polling/broadcast
  // can lag a second or two behind, during which the stale "pending" prop
  // would otherwise make Accept/Decline clickable again).
  const [localStatus, setLocalStatus] = useState<"accepted" | "declined" | "countered" | null>(null)
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterAmount, setCounterAmount] = useState("")

  const offer = message.offerData!
  const status = localStatus ?? offer.status
  const isPending = status === "pending"

  // The recipient of this particular offer message sees the action buttons.
  // Offers can now flow either direction (buyer -> seller, then seller's
  // counter goes seller -> buyer, etc.), so it's simply "not the sender".
  const canRespond = !isOwn && isPending

  const handleAccept = async () => {
    if (!chatId) return
    setLoading("accept")
    try {
      await ChatService.acceptChatOffer(
        chatId,
        message.id,
        offer.offerId,
        offer.offerAmount,
        {
          listingId:     offer.listingId,
          listingTitle:  offer.listingTitle,
          // Offers can flow either direction (buyer's offer, or seller's
          // counter-offer), so message.senderId is NOT reliably the buyer —
          // for a counter-offer bubble the seller is the sender. Always use
          // the chat's actual buyer id so the accepted_offers record is
          // keyed correctly and BuyNowModal can find the negotiated price.
          buyerId:       chat?.buyerId ?? message.senderId,
          sellerId:      "",                       // not needed for acceptedOffers write; offer doc has it
          originalPrice: offer.originalPrice,
        },
      )
      toast({ title: "Offer Accepted 🎉", description: "The buyer can now proceed to checkout at the negotiated price.", variant: "success" })
      setLocalStatus("accepted")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(null)
    }
  }

  const handleDecline = async () => {
    if (!chatId) return
    setLoading("decline")
    try {
      await ChatService.declineChatOffer(chatId, message.id, offer.offerId)
      toast({ title: "Offer Declined", description: "The buyer has been notified.", variant: "default" })
      setLocalStatus("declined")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(null)
    }
  }

  const handleCounter = async () => {
    if (!chatId || !chat) return
    const amountKobo = Math.round(parseFloat(counterAmount || "0") * 100)
    if (!amountKobo || amountKobo <= 0) return
    setLoading("counter")
    try {
      // Counter-offer keeps buyer/seller roles fixed to the chat's actual
      // buyer/seller (offers always flow buyer <-> seller); only the sender
      // of THIS particular offer message flips to whoever didn't send the
      // one being countered.
      const counterSenderId = isSeller ? (chat.sellerId ?? "") : (chat.buyerId ?? "")
      await ChatService.counterChatOffer(chatId, message.id, offer.offerId, counterSenderId, {
        offerAmount:   amountKobo,
        originalPrice: offer.originalPrice,
        listingId:     offer.listingId,
        listingTitle:  offer.listingTitle,
        buyerId:       chat.buyerId ?? "",
        buyerName:     chat.buyerName ?? "",
        sellerId:      chat.sellerId ?? "",
        sellerName:    chat.sellerName ?? "",
      })
      toast({ title: "Counter-offer sent", description: "Waiting for a response.", variant: "success" })
      setLocalStatus("countered")
      setCounterOpen(false)
      setCounterAmount("")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally {
      setLoading(null)
    }
  }

  const time =
    message.createdAt &&
    typeof message.createdAt !== "string" &&
    (message.createdAt as any).toDate
      ? formatDistanceToNow((message.createdAt as any).toDate(), { addSuffix: true })
      : typeof message.createdAt === "string"
      ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
      : "..."

  const discount =
    offer.originalPrice > 0
      ? Math.round((1 - offer.offerAmount / offer.originalPrice) * 100)
      : 0

  const statusBadge: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700",
    accepted:  "bg-green-100 text-green-700",
    declined:  "bg-red-100 text-red-700",
    countered: "bg-blue-100 text-blue-700",
  }

  return (
    <div className={cn("flex w-full mb-1", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl shadow-sm overflow-hidden border",
          isOwn ? "rounded-br-none" : "rounded-bl-none",
          isOwn ? "bg-primary/10 border-primary/25" : "bg-white border-border",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/50">
          <Tag className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="text-xs font-semibold text-primary">Offer</span>
          <span
            className={cn(
              "ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full capitalize",
              statusBadge[status] ?? "bg-gray-100 text-gray-600",
            )}
          >
            {status}
          </span>
        </div>

        {/* Amounts */}
        <div className="px-4 py-3 space-y-1">
          <p className="text-xs text-muted-foreground line-clamp-1 font-medium">
            {offer.listingTitle}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-foreground">
              {formatPrice(offer.offerAmount)}
            </span>
            {discount > 0 && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(offer.originalPrice)}
              </span>
            )}
            {discount > 0 && (
              <span className="text-xs font-semibold text-primary">
                {discount}% off
              </span>
            )}
          </div>
          {/* Offers only ever apply to a single unit (same rule enforced at
              checkout — BuyNowModal forces qty 1 for an accepted offer), so
              this is stated explicitly here too, for whichever side (buyer
              or seller) is viewing this bubble. */}
          <p className="text-[11px] text-muted-foreground">Qty: 1 piece</p>
        </div>

        {/* Action buttons — recipient of this offer, pending only */}
        {canRespond && !counterOpen && (
          <div className="flex gap-2 px-4 pb-3">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
              disabled={loading !== null}
              onClick={handleAccept}
            >
              {loading === "accept" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Accept
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
              disabled={loading !== null}
              onClick={() => setCounterOpen(true)}
            >
              <ArrowLeftRight className="h-3 w-3 mr-1" />
              Counter
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 h-8 text-xs"
              disabled={loading !== null}
              onClick={handleDecline}
            >
              {loading === "decline" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Decline
                </>
              )}
            </Button>
          </div>
        )}

        {/* Inline counter-amount entry */}
        {canRespond && counterOpen && (
          <div className="px-4 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">₦</span>
              <input
                type="number"
                min={1}
                autoFocus
                value={counterAmount}
                onChange={e => setCounterAmount(e.target.value)}
                placeholder="Your counter amount"
                className="flex-1 h-8 text-xs px-2 rounded-md border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading !== null || !counterAmount || parseFloat(counterAmount) <= 0}
                onClick={handleCounter}
              >
                {loading === "counter" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send Counter"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                disabled={loading !== null}
                onClick={() => { setCounterOpen(false); setCounterAmount("") }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Accepted / Declined / Countered state message */}
        {!canRespond && !isPending && (
          status === "accepted" ? (
            <div className="px-4 pb-3">
              <Link
                href={`/listings/${offer.listingId}?buyNow=1`}
                className="flex items-center justify-center gap-1.5 text-xs font-medium p-2.5 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                ✓ Offer accepted — Buy Now at {formatPrice(offer.offerAmount)}
              </Link>
            </div>
          ) : status === "countered" ? (
            <p className="text-xs px-4 pb-3 font-medium text-blue-600">
              ↔ A counter-offer was sent — see the latest offer below.
            </p>
          ) : (
            <p className="text-xs px-4 pb-3 font-medium text-red-600">
              ✗ Offer declined.
            </p>
          )
        )}

        {/* Pending label for the sender's own bubble */}
        {isOwn && isPending && (
          <p className="text-xs px-4 pb-3 text-muted-foreground">
            Waiting for a response…
          </p>
        )}

        {/* Timestamp */}
        <div className="px-4 pb-2 text-[10px] text-muted-foreground text-right">
          {time}
        </div>
      </div>
    </div>
  )
}

// ─── Default text bubble ──────────────────────────────────────────
function TextBubble({ message, isOwn }: Pick<MessageBubbleProps, "message" | "isOwn">) {
  const time =
    message.createdAt &&
    typeof message.createdAt !== "string" &&
    (message.createdAt as any).toDate
      ? formatDistanceToNow((message.createdAt as any).toDate(), { addSuffix: true })
      : typeof message.createdAt === "string"
      ? formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })
      : "..."

  return (
    <div className={cn("flex w-full mb-1", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm",
          isOwn
            ? "bg-primary text-white rounded-br-none"
            : "bg-white border text-foreground rounded-bl-none",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <div
          className={cn(
            "text-[10px] mt-1 flex items-center gap-1 justify-end",
            isOwn ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {message.isBlocked && <AlertTriangle className="h-3 w-3 text-destructive" />}
          {time}
        </div>
      </div>
    </div>
  )
}

// ─── Exported component ───────────────────────────────────────────
export function MessageBubble({ message, isOwn, isSeller, chatId, chat }: MessageBubbleProps) {
  if (message.type === "offer" && message.offerData) {
    return (
      <OfferBubble
        message={message}
        isOwn={isOwn}
        isSeller={isSeller}
        chatId={chatId}
        chat={chat}
      />
    )
  }
  return <TextBubble message={message} isOwn={isOwn} />
}
