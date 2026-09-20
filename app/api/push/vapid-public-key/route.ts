// app/api/push/vapid-public-key/route.ts
// Public endpoint. Returns only the public VAPID key so the browser can
// call pushManager.subscribe({ applicationServerKey }). Never returns the
// private key -- that stays server-side only.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getPublicVapidKey } from "@/lib/push-vapid"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function GET(_req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  try {
    const publicKey = await getPublicVapidKey(nativeDB)
    if (!publicKey) {
      return NextResponse.json({ error: "Push notifications are not configured yet" }, { status: 503 })
    }
    return NextResponse.json({ publicKey })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
