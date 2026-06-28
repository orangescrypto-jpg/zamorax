"use client"
// app/(admin)/admin/qna/page.tsx
// Admin view of all listing Q&A — can answer on behalf of any seller.

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  MessageSquare, Send, Loader2, CheckCircle2, Clock, Search,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface QnA {
  id: string
  listingId: string
  sellerId: string
  askerId: string
  askerName: string
  question: string
  answer?: string | null
  answeredAt?: string | null
  createdAt: string
}

export default function AdminQnAPage() {
  const { toast } = useToast()

  const [qnas, setQnas]       = useState<QnA[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<"all" | "unanswered">("unanswered")
  const [search, setSearch]   = useState("")
  const [answerMap, setAnswerMap]     = useState<Record<string, string>>({})
  const [answerLoading, setAnswerLoading] = useState<string | null>(null)

  const fetchAll = async () => {
    setLoading(true)
    try {
      // Pull all listing_qna rows via D1 proxy
      const res = await fetch("/api/d1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: "SELECT * FROM listing_qna ORDER BY created_at DESC LIMIT 200",
          params: [],
        }),
      })
      const data = await res.json()
      const rows: QnA[] = (data.results ?? []).map((r: any) => ({
        id:          r.id,
        listingId:   r.listing_id,
        sellerId:    r.seller_id,
        askerId:     r.asker_id,
        askerName:   r.asker_name ?? "Buyer",
        question:    r.question,
        answer:      r.answer ?? null,
        answeredAt:  r.answered_at ?? null,
        createdAt:   r.created_at,
      }))
      setQnas(rows)
    } catch (e: any) {
      toast({ title: "Failed to load Q&A", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleAnswer = async (qna: QnA) => {
    const answer = answerMap[qna.id]?.trim()
    if (!answer) return
    setAnswerLoading(qna.id)
    try {
      // Use the existing /api/qna answer endpoint
      const res = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:     "answer",
          qnaId:      qna.id,
          answer,
          askerId:    qna.askerId,
          sellerName: "Zamorax Support",
          listingId:  qna.listingId,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error ?? "Failed")

      // Optimistic update
      setQnas(prev => prev.map(q =>
        q.id === qna.id
          ? { ...q, answer, answeredAt: new Date().toISOString() }
          : q
      ))
      setAnswerMap(prev => ({ ...prev, [qna.id]: "" }))
      toast({ title: "Answer posted!", variant: "success" } as any)
    } catch (e: any) {
      toast({ title: "Could not post answer", description: e.message, variant: "destructive" })
    } finally {
      setAnswerLoading(null)
    }
  }

  const filtered = qnas
    .filter(q => filter === "all" || !q.answer)
    .filter(q =>
      !search.trim() ||
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      q.askerName.toLowerCase().includes(search.toLowerCase()) ||
      q.listingId.toLowerCase().includes(search.toLowerCase())
    )

  const unansweredCount = qnas.filter(q => !q.answer).length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Listing Q&A</h1>
          {unansweredCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unansweredCount} unanswered</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {(["unanswered", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 capitalize transition-colors ${
                filter === f ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f === "unanswered" ? `Unanswered (${unansweredCount})` : `All (${qnas.length})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search questions or buyer name…"
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
          {filter === "unanswered" ? "All questions have been answered 🎉" : "No questions yet"}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(qna => (
            <div key={qna.id} className="border rounded-xl overflow-hidden">
              {/* Question row */}
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
                      className="text-xs text-primary underline truncate max-w-[160px]"
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
                    Z
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Zamorax Support</span>
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary">Admin</Badge>
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

              {/* Answer box — always available to admin even if already answered */}
              <div className="p-4 border-t bg-amber-50 space-y-2">
                <p className="text-xs text-amber-700 font-medium">
                  {qna.answer ? "Update answer" : "Answer this question (visible to all buyers)"}
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
