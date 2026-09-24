export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

export async function POST(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB
  const auth = await requireAuth(req, nativeDB)
  if (!auth.ok) return auth.error

  const body = await req.json().catch(() => ({}))
  const phone = String(body?.phone ?? "").trim()

  if (phone.length < 10) {
    return NextResponse.json({ error: "Enter a valid phone number (e.g., 08012345678)" }, { status: 400 })
  }

  try {
    await d1Query(
      "UPDATE users SET phone = ?, phone_verified = 0, updated_at = datetime('now') WHERE uid = ?",
      [phone, auth.uid],
      nativeDB,
    )
    return NextResponse.json({ ok: true, phone })
  } catch (err) {
    console.error("[api/auth/update-phone] failed:", err)
    return NextResponse.json({ error: "Could not update phone number." }, { status: 500 })
  }
}
