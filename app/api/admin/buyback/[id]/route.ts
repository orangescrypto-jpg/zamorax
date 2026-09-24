export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireModerator } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { r2Delete, R2_PUBLIC_URL } from "@/lib/r2/client"
import { Emails } from "@/src/services/email"

type RouteContext = { params: Promise<{ id: string }>; env?: { DB?: unknown; ZAMORAX_BUCKET?: unknown } }

function toR2Key(image: string): string {
  const base = R2_PUBLIC_URL()
  if (base && image.startsWith(base)) return image.slice(base.length).replace(/^\//, "")
  return image
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireModerator(req, nativeDB)
  if (!auth.ok) return auth.error

  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const { status, finalPrice, priceAdjustReason, paymentMethod, paymentReference } = body ?? {}

  const VALID_STATUSES = new Set(["accepted", "rejected", "paid", "completed"])
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 })
  }

  try {
    const rows = await d1Query(
      "SELECT id, brand, model, contact_name, contact_email, status FROM buyback_requests WHERE id = ? LIMIT 1",
      [id],
      nativeDB,
    )
    const request = rows?.results?.[0] as Record<string, unknown> | undefined
    if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 })

    const now = new Date().toISOString()
    const updates: string[] = ["status = ?", "updated_at = ?"]
    const params: unknown[] = [status, now]

    if (status === "accepted") {
      updates.push("inspected_by = ?", "inspected_at = ?")
      params.push(auth.uid, now)
      if (finalPrice != null) { updates.push("final_price = ?"); params.push(Math.round(Number(finalPrice))) }
      if (priceAdjustReason) { updates.push("price_adjust_reason = ?"); params.push(priceAdjustReason) }
    }

    if (status === "rejected") {
      updates.push("inspected_by = ?", "inspected_at = ?")
      params.push(auth.uid, now)
    }

    if (status === "paid") {
      if (paymentMethod) { updates.push("payment_method = ?"); params.push(paymentMethod) }
      if (paymentReference) { updates.push("payment_reference = ?"); params.push(paymentReference) }
    }

    if (status === "completed") {
      updates.push("completed_by = ?", "completed_at = ?")
      params.push(auth.uid, now)
    }

    params.push(id)
    await d1Query(
      `UPDATE buyback_requests SET ${updates.join(", ")} WHERE id = ?`,
      params,
      nativeDB,
    )

    if (status === "rejected") {
      try {
        await d1Query(
          "UPDATE buyback_requests SET rejection_notified_at = ? WHERE id = ?",
          [now, id],
          nativeDB,
        )
        if (request.contact_email) {
          await Emails.buybackRejected(String(request.contact_email), {
            contactName: String(request.contact_name || "there"),
            brand: String(request.brand || ""),
            model: String(request.model || ""),
          })
        }
      } catch (err) {
        console.error("[admin/buyback PATCH] rejection email failed:", err)
      }
    }

    return NextResponse.json({ ok: true, status })
  } catch (err) {
    console.error("[admin/buyback PATCH] failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update request." },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const auth = await requireModerator(req, nativeDB)
  if (!auth.ok) return auth.error

  const { id } = await context.params

  try {
    const rows = await d1Query(
      "SELECT id, images FROM buyback_requests WHERE id = ? LIMIT 1",
      [id],
      nativeDB,
    )
    const request = rows?.results?.[0] as Record<string, unknown> | undefined
    if (!request) return NextResponse.json({ error: "Request not found." }, { status: 404 })

    let images: string[] = []
    try { images = JSON.parse(String(request.images ?? "[]")) } catch { images = [] }

    for (const img of images) {
      if (!img) continue
      try {
        await r2Delete(toR2Key(String(img)), (context as any)?.env?.ZAMORAX_BUCKET)
      } catch (err) {
        console.error(`[admin/buyback DELETE] R2 delete failed for ${img}:`, err)
      }
    }

    await d1Query("DELETE FROM buyback_requests WHERE id = ?", [id], nativeDB)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[admin/buyback DELETE] failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete request." },
      { status: 500 },
    )
  }
}
