// app/api/qna/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { requireAuth } from "@/lib/auth-server"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

// GET /api/qna?listingId=xxx
export async function GET(req: NextRequest, context: RouteContext) {
  const listingId = req.nextUrl.searchParams.get("listingId")
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 })

  const nativeDB = (context as any)?.env?.DB

  try {
    const result = await d1Query(
      "SELECT * FROM listing_qna WHERE listing_id = ? ORDER BY created_at DESC",
      [listingId],
      nativeDB,
    )
    const qnas = (result?.results ?? []).map((r: any) => ({
      id:          r.id,
      listingId:   r.listing_id,
      sellerId:    r.seller_id,
      askerId:     r.asker_id,
      askerName:   r.asker_name,
      question:    r.question,
      answer:      r.answer ?? null,
      answeredAt:  r.answered_at ?? null,
      createdAt:   r.created_at,
    }))
    return NextResponse.json({ qnas })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/qna  — action: "ask" | "answer"
export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const body = await req.json()
  const nativeDB = (context as any)?.env?.DB

  // ── Ask a question ────────────────────────────────────────────────────────
  if (body.action === "ask") {
    const { listingId, sellerId, askerId, askerName, question } = body
    if (!listingId || !sellerId || !question?.trim()) {
      return NextResponse.json({ error: "listingId, sellerId, and question are required" }, { status: 400 })
    }
    if (auth.uid === sellerId) {
      return NextResponse.json({ error: "You cannot ask questions on your own listing" }, { status: 403 })
    }

    const id = crypto.randomUUID()

    try {
      await d1Query(
        `INSERT INTO listing_qna (id, listing_id, seller_id, asker_id, asker_name, question)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, listingId, sellerId, askerId, askerName ?? "Buyer", question.trim()],
        nativeDB,
      )

      // Notify the seller — fire and forget, don't fail the request if it errors
      try {
        await d1Query(
          `INSERT INTO notifications (id, user_id, type, title, body, link, is_read)
           VALUES (?, ?, 'system', ?, ?, ?, 0)`,
          [
            crypto.randomUUID(),
            sellerId,
            "New question on your listing",
            `"${question.trim().slice(0, 80)}…"`,
            `/listings/${listingId}#qna`,
          ],
          nativeDB,
        )
      } catch (notifErr) {
        console.warn("Notification insert failed (non-fatal):", notifErr)
      }

      return NextResponse.json({ ok: true, id })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  // ── Answer a question ─────────────────────────────────────────────────────
  if (body.action === "answer") {
    const { qnaId, answer, askerId, sellerName, listingId } = body
    if (!qnaId || !answer?.trim()) {
      return NextResponse.json({ error: "qnaId and answer are required" }, { status: 400 })
    }

    try {
      await d1Query(
        `UPDATE listing_qna SET answer = ?, answered_at = datetime('now') WHERE id = ?`,
        [answer.trim(), qnaId],
        nativeDB,
      )

      // Notify the asker — non-fatal
      if (askerId) {
        try {
          await d1Query(
            `INSERT INTO notifications (id, user_id, type, title, body, link, is_read)
             VALUES (?, ?, 'system', ?, ?, ?, 0)`,
            [
              crypto.randomUUID(),
              askerId,
              `${sellerName ?? "Seller"} answered your question`,
              answer.trim().slice(0, 100),
              `/listings/${listingId}#qna`,
            ],
            nativeDB,
          )
        } catch (notifErr) {
          console.warn("Notification insert failed (non-fatal):", notifErr)
        }
      }

      return NextResponse.json({ ok: true })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
