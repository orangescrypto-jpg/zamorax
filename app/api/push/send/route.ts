// app/api/push/send/route.ts
// Admin-only manual send, and the internal entry point other server code
// can call over HTTP if it cannot import src/services/webPush.ts directly
// (e.g. from a Cloudflare Worker cron with a different bundle). Prefer
// importing sendPushNotification directly when in the same Next.js app.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { sendPushNotification, type PushNotificationType } from "@/src/services/webPush"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const VALID_TYPES: PushNotificationType[] = [
  "new_listing",
  "account_activity",
  "price_drop",
  "back_in_stock",
  "layaway_reminder",
]

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { userId, type, title, body, link } = await req.json()

    if (!userId || !type || !title || !body) {
      return NextResponse.json({ error: "userId, type, title, body required" }, { status: 400 })
    }
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 })
    }

    const result = await sendPushNotification({ userId, type, title, body, link, nativeDB })
    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[push/send]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
