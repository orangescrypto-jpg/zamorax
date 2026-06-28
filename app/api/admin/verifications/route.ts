// app/api/admin/verifications/route.ts
// Reads/writes verification_requests table in D1.
// Replaces old Firestore "verificationRequests" collection.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function rowToRequest(row: Record<string, unknown>) {
  return {
    id:              String(row.id),
    status:          String(row.status ?? "pending"),
    type:            String(row.type ?? "nin"),
    userId:          row.user_id   ? String(row.user_id)   : undefined,
    userName:        row.user_name  ? String(row.user_name)  : undefined,
    userEmail:       row.user_email ? String(row.user_email) : undefined,
    value:           row.value      ? String(row.value)      : undefined,   // NIN number
    nin:             row.value      ? String(row.value)      : undefined,   // alias
    documentUrl:     row.document_url ? String(row.document_url) : undefined,
    selfieUrl:       row.selfie_url   ? String(row.selfie_url)   : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    reviewedBy:      row.reviewed_by  ? String(row.reviewed_by)  : undefined,
    createdAt:       row.created_at   ? String(row.created_at)   : undefined,
    reviewedAt:      row.reviewed_at  ? String(row.reviewed_at)  : undefined,
  }
}

// GET /api/admin/verifications — list all
export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const result = await d1Query(
      `SELECT * FROM verification_requests ORDER BY created_at DESC LIMIT 200`,
      [], nativeDB,
    )
    const rows = (result as any)?.results ?? []
    return NextResponse.json({ requests: rows.map((r: any) => rowToRequest(r)) })
  } catch (err: any) {
    console.error("[admin/verifications GET]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin/verifications — approve or reject
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { id, action, reason, userId, type } = await req.json()
    if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 })

    const now = new Date().toISOString()

    if (action === "approve") {
      await d1Query(
        `UPDATE verification_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
        [auth.uid, now, now, id], nativeDB,
      )
      // If NIN type, also mark user as nin_verified
      if (type === "nin" && userId) {
        await d1Query(
          `UPDATE users SET nin_verified = 1, is_seller_ready = 1, verification_level = 'nin', updated_at = ? WHERE uid = ?`,
          [now, userId], nativeDB,
        )
      }
    } else if (action === "reject") {
      await d1Query(
        `UPDATE verification_requests SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
        [reason ?? "", auth.uid, now, now, id], nativeDB,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[admin/verifications PATCH]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
