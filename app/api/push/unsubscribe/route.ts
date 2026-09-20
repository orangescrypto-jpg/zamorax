// app/api/push/unsubscribe/route.ts
// Removes a browser's PushSubscription. Called when the user turns
// notifications off, or when the browser reports the subscription as
// expired/invalid.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { endpoint } = await req.json()
    if (!endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 })
    }

    await d1Query(
      "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?",
      [endpoint, auth.uid],
      nativeDB,
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[push/unsubscribe]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
