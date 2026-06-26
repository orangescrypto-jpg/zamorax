// app/api/auth/refresh/route.ts
// Uses the fb-refresh-token httpOnly cookie to get a new Firebase ID token
// and reissue all auth cookies. Called to keep the session alive.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("fb-refresh-token")?.value
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 })
    }

    if (!FIREBASE_API_KEY) {
      return NextResponse.json({ error: "NEXT_PUBLIC_FIREBASE_API_KEY not set" }, { status: 500 })
    }

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      },
    )

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Token refresh failed" },
        { status: 401 },
      )
    }

    const { id_token: idToken, refresh_token: newRefreshToken, user_id: uid, expires_in: expiresIn } = data
    const maxAge = parseInt(expiresIn ?? "3600", 10)

    const response = NextResponse.json({ ok: true, uid })

    response.cookies.set("fb-access-token", idToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge,
    })
    response.cookies.set("fb-uid", uid, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   7 * 24 * 60 * 60,
    })
    response.cookies.set("fb-refresh-token", newRefreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   7 * 24 * 60 * 60,
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
