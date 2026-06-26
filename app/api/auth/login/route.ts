// app/api/auth/login/route.ts
// Server-side Firebase auth proxy.
// Signs the user in via the Firebase REST API (no client SDK on server),
// returns the Firebase ID token, and sets httpOnly cookies for SSR auth.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

// Firebase REST auth endpoint (does not require Admin SDK)
async function firebaseSignIn(
  email: string,
  password: string,
): Promise<{ idToken: string; refreshToken: string; localId: string; expiresIn: string }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const json = await res.json()
  if (!res.ok) {
    const code = json.error?.message ?? "LOGIN_FAILED"
    throw new Error(code)
  }
  return json
}

// Map Firebase REST error codes to user-friendly messages
function friendlyError(code: string): string {
  const map: Record<string, string> = {
    "INVALID_EMAIL":             "Invalid email address.",
    "EMAIL_NOT_FOUND":           "No account found with this email.",
    "INVALID_PASSWORD":          "Incorrect password.",
    "INVALID_LOGIN_CREDENTIALS": "Incorrect email or password.",
    "USER_DISABLED":             "This account has been suspended.",
    "TOO_MANY_ATTEMPTS_TRY_LATER": "Too many attempts. Please wait and try again.",
  }
  return map[code] ?? "Login failed. Please try again."
}

export async function POST(req: NextRequest) {
  try {
    if (!FIREBASE_API_KEY) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_FIREBASE_API_KEY is not set on the server." },
        { status: 500 },
      )
    }

    const { email, password } = await req.json()
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    let firebaseData: Awaited<ReturnType<typeof firebaseSignIn>>
    try {
      firebaseData = await firebaseSignIn(email, password)
    } catch (err: any) {
      return NextResponse.json({ error: friendlyError(err.message) }, { status: 401 })
    }

    const { idToken, refreshToken, localId: uid, expiresIn } = firebaseData
    const maxAge = parseInt(expiresIn ?? "3600", 10)

    const response = NextResponse.json({
      user:    { id: uid, email },
      session: { access_token: idToken, refresh_token: refreshToken },
    })

    // httpOnly cookie so API routes can verify identity server-side
    response.cookies.set("fb-access-token", idToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge,
    })
    // fb-uid lives 7 days so session restore keeps working between token refreshes
    response.cookies.set("fb-uid", uid, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   7 * 24 * 60 * 60,
    })
    if (refreshToken) {
      response.cookies.set("fb-refresh-token", refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        path:     "/",
        maxAge:   7 * 24 * 60 * 60,
      })
    }

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
