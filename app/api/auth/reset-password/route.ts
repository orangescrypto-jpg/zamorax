// app/api/auth/reset-password/route.ts
// Sends a Firebase password-reset email via the REST API.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email)
      return NextResponse.json({ error: "Email required" }, { status: 400 })

    if (!FIREBASE_API_KEY)
      return NextResponse.json({ error: "NEXT_PUBLIC_FIREBASE_API_KEY not set" }, { status: 500 })

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          requestType:  "PASSWORD_RESET",
          email,
        }),
      },
    )

    const json = await res.json()
    // Firebase returns 400 for unknown email — treat as success to avoid user enumeration
    if (!res.ok) {
      const code = json.error?.message ?? ""
      if (code === "EMAIL_NOT_FOUND") {
        // Silent success — don't reveal whether the email exists
        return NextResponse.json({ ok: true })
      }
      return NextResponse.json({ error: json.error?.message ?? "Failed to send reset email" }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
