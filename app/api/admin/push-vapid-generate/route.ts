// app/api/admin/push-vapid-generate/route.ts
// Admin-only. Generates a brand new VAPID key pair and returns it so the
// admin UI can preview it before saving. Does not write to the database --
// saving happens via POST /api/admin/push-settings, same as any other
// sub-settings save, so a generated-but-unsaved key never silently
// replaces the live one.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import webpush from "web-push"

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  try {
    const keys = webpush.generateVAPIDKeys()
    return NextResponse.json({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    })
  } catch (err: any) {
    console.error("[admin/push-vapid-generate]", err)
    return NextResponse.json({ error: err.message || "Key generation failed" }, { status: 500 })
  }
}
