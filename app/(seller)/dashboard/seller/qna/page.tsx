"use client"
// app/(seller)/dashboard/seller/qna/page.tsx
// Seller view — questions on their own listings only. Can answer directly here.

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  MessageSquare, Send, Loader2, CheckCircle2, Clock, Search, RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface QnA {
  id: string
  listingId: string
  askerId: string
  askerName: string
  question: string
  answer?: string | null
  answeredAt?: string | null
  createdAt: string
}

export default function SellerQnAPage() {
  const user        = useAuthStore(s => s.user)
  const { toast }   = useToast()

  const [qnas, setQnas]       = useState<QnA[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<"unanswered" | "all">("unanswered")
  const [search, setSearch]   = useState("")
  const [answerMap, setAnswerMap]         = useState<Record<string, string>>({})
  const [answerLoading, setAnswerLoading] = useState<string | null>(null)

  const fetchQnas = async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const res = await fetch("/api/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "SELECT * FROM listing_qna WHERE seller_id = ? ORDER BY created_at DESC LIMIT 200",
          params: [user.uid],
        }),
      })
      const data = await res.json()
      setQnas((data.results ?? []).map((r: any) => ({
        id:         r.id,
        listingId:  r.listing_id,
        askerId:    r.asker_id,
        askerName:  r.asker_name ?? "Buyer",
        question:   r.question,
        answer:     r.answer ?? null,
        answeredAt: r.answered_at ?? null,
        createdAt:  r.created_at,
      })))
    } catch (e: any) {
      toast({ title: "Failed to load questions", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQnas() }, [user?.uid])

  const handleAnswer = async (qna: QnA) => {
    const answer = answerMap[qna.id]?.trim()
    if (!answer) return
    setAnswerLoading(qna.id)
    try {
      const res = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:     "answer",
          qnaId:      qna.id,
          answer,
          askerId:    qna.askerId,
          sellerName: user?.fullName || user?.username || "Seller",
          listingId:  qna.listingId,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? "Failed")

      setQnas(prev => prev.map(q =>
        q.id === qna.id
          ? { ...q, answer, answeredAt: new Date().toISOString() }
          : q
      ))
      setAnswerMap(prev => ({ ...prev, [qna.id]: "" }))
      toast({ title: "Answer posted!" } as any)
    } catch (e: any) {
      toast({ title: "Could not post answer", description: e.message, variant: "destructive" })
    } finally {
      setAnswerLoading(null) }
  }

  const sellerName = user?.fullName || user?.username || "Seller"
  const unansweredCount = qnas.filter(q => !q.answer).length

  const filtered = qnas
    .filter(q => filter === "all" || !q.answer)
    .filter(q =>
      !search.trim() ||
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.askerName.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <div className="container py-6 pb-24 max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-heading font-bold">Questions & Answers</h1>
          {unansweredCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unansweredCount} unanswered</Badge>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={fetchQnas} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {(["unanswered", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 transition-colors ${
                filter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "unanswered" ? `Unanswered (${unansweredCount})` : `All (${qnas.length})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
          {filter === "unanswered" ? "All questions answered 🎉" : "No questions yet on your listings"}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(qna => (
            <div key={qna.id} className="border rounded-xl overflow-hidden">
              {/* Question */}
              <div className="flex gap-3 p-4 bg-card">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {qna.askerName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{qna.askerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(qna.createdAt), { addSuffix: true })}
                    </span>
                    <a
                      href={`/listings/${qna.listingId}`}
                      target="_blank"
                      className="text-xs text-primary underline"
                    >
                      View listing
                    </a>
                  </div>
                  <p className="text-sm mt-1">{qna.question}</p>
                </div>
                {qna.answer
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-1" />
                  : <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-1" />
                }
              </div>

              {/* Existing answer */}
              {qna.answer && (
                <div className="flex gap-3 p-4 bg-primary/5 border-t">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {sellerName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{sellerName}</span>
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary">Seller</Badge>
                      {qna.answeredAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(qna.answeredAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1">{qna.answer}</p>
                  </div>
                </div>
              )}

              {/* Answer / update box */}
              <div className="p-4 border-t bg-amber-50 space-y-2">
                <p className="text-xs text-amber-700 font-medium">
                  {qna.answer ? "Update your answer" : "Answer this question (visible to all buyers)"}
                </p>
                <Textarea
                  placeholder="Type your answer…"
                  value={answerMap[qna.id] || ""}
                  onChange={e => setAnswerMap(prev => ({ ...prev, [qna.id]: e.target.value }))}
                  rows={2}
                  className="bg-white resize-none text-sm"
                  maxLength={500}
                />
                <Button
                  size="sm"
                  className="bg-primary text-white"
                  onClick={() => handleAnswer(qna)}
                  disabled={!answerMap[qna.id]?.trim() || answerLoading === qna.id}
                >
                  {answerLoading === qna.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Send className="h-3.5 w-3.5 mr-1.5" /> Post Answer</>
                  }
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
