// app/api/debug/settings-auth-check/route.ts — Firebase version
// Verifies that auth and D1 env vars are wired up correctly.
// Remove or restrict in production.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken"

async function tryVerifyBearer(req: NextRequest): Promise<{ uid: string | null; method: string | null; error: string | null }> {
  const authHeader  = req.headers.get("authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (!bearerToken) return { uid: null, method: null, error: "No Bearer token in Authorization header" }

  const uid = await verifyFirebaseToken(bearerToken).catch(() => null)
  if (uid) return { uid, method: "firebase_bearer", error: null }

  return { uid: null, method: null, error: "Firebase token verification failed" }
}

export async function GET(req: NextRequest) {
  const authResult = await tryVerifyBearer(req)

  const cookieUid = req.cookies.get("fb-uid")?.value ?? null
  const errors: string[] = []

  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY)    errors.push("NEXT_PUBLIC_FIREBASE_API_KEY not set")
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) errors.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID not set")
  if (!process.env.FIREBASE_SERVICE_ACCOUNT)         errors.push("FIREBASE_SERVICE_ACCOUNT not set")
  if (!process.env.CF_ACCOUNT_ID)                    errors.push("CF_ACCOUNT_ID not set")
  if (!process.env.CF_D1_DATABASE_ID)                errors.push("CF_D1_DATABASE_ID not set")
  if (!process.env.CF_API_TOKEN)                     errors.push("CF_API_TOKEN not set")

  return NextResponse.json({
    auth: authResult,
    cookieUid,
    envErrors: errors,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY:    !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY    ? "set" : "MISSING",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID  ? "set" : "MISSING",
      FIREBASE_SERVICE_ACCOUNT:        !!process.env.FIREBASE_SERVICE_ACCOUNT         ? "set" : "MISSING",
      CF_ACCOUNT_ID:                   !!process.env.CF_ACCOUNT_ID                    ? "set" : "MISSING",
      CF_D1_DATABASE_ID:               !!process.env.CF_D1_DATABASE_ID                ? "set" : "MISSING",
      CF_API_TOKEN:                    !!process.env.CF_API_TOKEN                     ? "set" : "MISSING",
    },
  })
}
