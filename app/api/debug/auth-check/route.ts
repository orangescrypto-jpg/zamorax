// app/api/debug/auth-check/route.ts — Firebase version
// Debug endpoint to check if Firebase auth env vars are set.
// Remove or restrict in production.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken"

export async function GET(req: NextRequest) {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  let uid: string | null = null
  let tokenValid = false

  if (bearerToken) {
    uid = await verifyFirebaseToken(bearerToken).catch(() => null)
    tokenValid = !!uid
  }

  return NextResponse.json({
    env: {
      FIREBASE_API_KEY:        !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY    ? "set" : "MISSING",
      FIREBASE_AUTH_DOMAIN:    !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "set" : "MISSING",
      FIREBASE_PROJECT_ID:     !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID  ? "set" : "MISSING",
      FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT        ? "set" : "MISSING",
    },
    bearer:     bearerToken ? `${bearerToken.slice(0, 20)}...` : null,
    tokenValid,
    uid,
    cookieUid:  req.cookies.get("fb-uid")?.value ?? null,
  })
}
