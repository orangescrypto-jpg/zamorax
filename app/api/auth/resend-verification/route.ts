// app/api/auth/resend-verification/route.ts
// Resends the Firebase email verification link via Admin SDK.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getAdminAuth } from "@/lib/firebase/admin"

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email)
      return NextResponse.json({ error: "Email required" }, { status: 400 })

    // Generate verification link — you can send this via your email provider (Resend etc.)
    // or use the Firebase REST API to trigger the built-in Firebase verification email.
    const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (!FIREBASE_API_KEY)
      return NextResponse.json({ error: "NEXT_PUBLIC_FIREBASE_API_KEY not set" }, { status: 500 })

    // Look up the user first so we can get their ID token if needed
    let idToken: string | undefined
    try {
      // Get the user record — we need their uid to generate a sign-in link
      const userRecord = await getAdminAuth().getUserByEmail(email)
      if (userRecord.emailVerified) {
        return NextResponse.json({ ok: true }) // already verified, nothing to do
      }

      // Generate a custom token then exchange for ID token via REST
      // so we can call sendEmailVerification using the Firebase REST OOB API
      const customToken = await getAdminAuth().createCustomToken(userRecord.uid)
      const signInRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token: customToken, returnSecureToken: true }),
        },
      )
      const signInJson = await signInRes.json()
      idToken = signInJson.idToken
    } catch (e: any) {
      console.warn("[resend-verification] Failed to get idToken:", e.message)
    }

    if (!idToken) {
      return NextResponse.json({ error: "Could not resend verification — user may not exist" }, { status: 400 })
    }

    // Send the verification email via Firebase REST API
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          requestType:  "VERIFY_EMAIL",
          idToken,
        }),
      },
    )

    const json = await res.json()
    if (!res.ok)
      return NextResponse.json({ error: json.error?.message ?? "Failed to resend" }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
