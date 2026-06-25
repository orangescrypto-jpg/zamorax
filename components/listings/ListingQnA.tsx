"use client"

import { AdminService, orderBy, onSnapshot, where, serverTimestamp } from "@/src/services"
// components/listings/ListingQnA.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, ChevronDown, ChevronUp, Loader2, ShieldCheck } from "lucide-react"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { formatDistanceToNow } from "date-fns"

interface QnA {
  id: string
  listingId: string
  askerId: string
  askerName: string
  question: string
  answer?: string
  answeredAt?: any
  createdAt: any
}

interface Props {
  listingId: string
  sellerId: string
  sellerName: string
}

export function ListingQnA({ listingId, sellerId, sellerName }: Props) {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const { settings } = usePlatformSettings()

  const [qnas, setQnas] = useState<QnA[]>([])
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState("")
  const [askLoading, setAskLoading] = useState(false)
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({})
  const [answerLoading, setAnswerLoading] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const isSeller = user?.uid === sellerId

  if (!settings.qnaEnabled) return null

  useEffect(() => {
    const q = AdminService._ref_("listingQnA", [
      where("listingId", "==", listingId),
      orderBy("createdAt", "desc")
    ])
    return onSnapshot(q, snap => {
      setQnas(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as QnA)))
      setLoading(false)
    })
  }, [listingId])

  const handleAsk = async () => {
    if (!user?.uid) { router.push("/login"); return }
    if (!question.trim()) return
    if (user.uid === sellerId) {
      toast({ title: "You can't ask questions on your own listing", variant: "destructive" })
      return
    }

    setAskLoading(true)
    try {
      await AdminService.addDoc("listingQnA", {
        listingId,
        sellerId,
        askerId: user.uid,
        askerName: user.fullName || user.username || "Buyer",
        question: question.trim(),
        answer: null,
        createdAt: serverTimestamp() })

      // Notify the seller
      await AdminService.addDoc("notifications", {
        userId: sellerId,
        type: "system",
        title: "New question on your listing",
        body: `"${question.trim().slice(0, 80)}…"`,
        link: `/listings/${listingId}#qna`,
        read: false,
        createdAt: serverTimestamp() })

      setQuestion("")
      toast({ title: "Question posted!", description: "The seller will be notified.", variant: "success" })
    } catch {
      toast({ title: "Could not post question", variant: "destructive" })
    } finally { setAskLoading(false) }
  }

  const handleAnswer = async (qnaId: string) => {
    const answer = answerMap[qnaId]?.trim()
    if (!answer) return
    setAnswerLoading(qnaId)
    try {
      await AdminService.updateDoc("listingQnA", qnaId, {
        answer,
        answeredAt: serverTimestamp() })
      // Notify the asker
      const qna = qnas.find(q => q.id === qnaId)
      if (qna?.askerId) {
        await AdminService.addDoc("notifications", {
          userId: qna.askerId,
          type: "system",
          title: `${sellerName} answered your question`,
          body: answer.slice(0, 100),
          link: `/listings/${listingId}#qna`,
          read: false,
          createdAt: serverTimestamp() })
      }
      setAnswerMap(prev => ({ ...prev, [qnaId]: "" }))
      toast({ title: "Answer posted!", variant: "success" })
    } catch {
      toast({ title: "Could not post answer", variant: "destructive" })
    } finally { setAnswerLoading(null) }
  }

  const displayed = showAll ? qnas : qnas.slice(0, 3)

  return (
    <section id="qna" className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-heading font-bold">
            Questions & Answers
            {qnas.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({qnas.length})</span>
            )}
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Sellers typically respond within {settings.qnaSellerResponseSLAHours}h
        </span>
      </div>

      {/* Ask a question (non-seller buyers only) */}
      {!isSeller && (
        <div className="bg-muted/40 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">Have a question about this item?</p>
          <Textarea
            placeholder="Ask the seller something... (visible to all buyers)"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={2}
            maxLength={300}
            className="bg-white resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{question.length}/300</p>
            <Button
              size="sm"
              className="bg-primary text-white hover:bg-primary/90"
              onClick={handleAsk}
              disabled={!question.trim() || askLoading}
            >
              {askLoading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><Send className="h-3.5 w-3.5 mr-1.5" /> Post Question</>
              }
            </Button>
          </div>
        </div>
      )}

      {/* Q&A list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : qnas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-xl">
          No questions yet. Be the first to ask!
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map(qna => (
            <div key={qna.id} className="border border-border rounded-xl overflow-hidden">
              {/* Question */}
              <div className="flex gap-3 p-4 bg-card">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    {qna.askerName?.[0]?.toUpperCase() || "B"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{qna.askerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {qna.createdAt?.toDate
                        ? formatDistanceToNow(qna.createdAt.toDate(), { addSuffix: true })
                        : ""}
                    </p>
                  </div>
                  <p className="text-sm mt-1">{qna.question}</p>
                </div>
              </div>

              {/* Answer */}
              {qna.answer ? (
                <div className="flex gap-3 p-4 bg-primary/5 border-t border-border">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-white text-xs font-bold">
                      {sellerName?.[0]?.toUpperCase() || "S"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{sellerName}</p>
                      <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0 h-4">
                        <ShieldCheck className="h-3 w-3 mr-0.5" /> Seller
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {qna.answeredAt?.toDate
                          ? formatDistanceToNow(qna.answeredAt.toDate(), { addSuffix: true })
                          : ""}
                      </p>
                    </div>
                    <p className="text-sm mt-1">{qna.answer}</p>
                  </div>
                </div>
              ) : isSeller ? (
                // Seller reply box
                <div className="p-4 border-t border-border bg-amber-50 space-y-2">
                  <p className="text-xs text-amber-700 font-medium">Answer this question (visible to all buyers)</p>
                  <Textarea
                    placeholder="Type your answer..."
                    value={answerMap[qna.id] || ""}
                    onChange={e => setAnswerMap(prev => ({ ...prev, [qna.id]: e.target.value }))}
                    rows={2}
                    className="bg-white resize-none text-sm"
                    maxLength={500}
                  />
                  <Button
                    size="sm"
                    className="bg-primary text-white hover:bg-primary/90"
                    onClick={() => handleAnswer(qna.id)}
                    disabled={!answerMap[qna.id]?.trim() || answerLoading === qna.id}
                  >
                    {answerLoading === qna.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Send className="h-3.5 w-3.5 mr-1.5" /> Post Answer</>
                    }
                  </Button>
                </div>
              ) : (
                <div className="px-4 py-3 border-t border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground italic">Awaiting seller's answer…</p>
                </div>
              )}
            </div>
          ))}

          {qnas.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-primary font-medium py-2 hover:underline"
            >
              {showAll
                ? <><ChevronUp className="h-4 w-4" /> Show less</>
                : <><ChevronDown className="h-4 w-4" /> Show all {qnas.length} questions</>
              }
            </button>
          )}
        </div>
      )}
    </section>
  )
}
